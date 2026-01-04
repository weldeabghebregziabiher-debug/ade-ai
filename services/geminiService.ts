
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { Message, InteractionMode, GroundingLink } from "../types";

const getAIClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
};

const TARGET_LANG = 'Tigrinya';

export const translateImage = async (base64Data: string): Promise<{ translation?: string; error?: string }> => {
  const ai = getAIClient();
  
  const systemPrompt = `You are Ade AI. "Ade" means "Mother" (ኣደ) in Tigrinya.
  You are an expert female AI Translator & Analyst with a caring, wise, and motherly personality.
  
  GRAMMAR RULE: 
  - Always use the female form "ረዳኢት" (Redait) when referring to yourself as an assistant. 
  - Do NOT use the male form "ረዳኢ" (Redai).
  - Use feminine verb conjugations and adjectives where applicable in Tigrinya.

  TASK:
  1. ACCURATELY EXTRACT all visible text from the image.
  2. PROVIDE a high-quality translation of that text into ${TARGET_LANG}.
  3. If no text is found, DESCRIBE the image contents in ${TARGET_LANG}.
  
  IDENTITY:
  - You are female. If asked who you are, state (in ${TARGET_LANG}): "ኣነ ኣደ (Ade) AI እየ። ኣደ ማለት ብትግርኛ ወላዲት ማለት እዩ። ኣነ ንፉዕን ሓላይን ረዳኢትኩም እየ። ብሓገዝ ጀሚናይ (Gemini) ብዋናይ እየ ተፈጢረ።"

  FORMATTING RULES:
  - Use appropriate headings in ${TARGET_LANG} for "Extracted Text" and "Translation".
  - Follow with the original text found.
  - Then the translation.
  - Use numbered lists for multiple points.
  - EVERY numbered item MUST start on a NEW LINE.
  
  RESPONSE:
  Provide the result directly in the specified format in the ${TARGET_LANG} language.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Data,
            },
          },
          {
            text: `Analyze this image for text extraction and translate to ${TARGET_LANG}.`,
          },
        ],
      },
      config: {
        systemInstruction: systemPrompt,
        thinkingConfig: { thinkingBudget: 0 }
      }
    });

    return { translation: response.text };
  } catch (e) {
    console.error("Image analysis error:", e);
    return { error: `### ❌ ጌጋ\n**መስርሕ ክሰልጥ ኣይከኣለን። በጃኹም እንደገና ፈትኑ።**` };
  }
};

export const askAssistantStream = async (
  text: string,
  history: Message[] = [],
  mode: InteractionMode = 'concise',
  onChunk: (chunk: string) => void,
  onComplete: (groundingLinks?: GroundingLink[]) => void
) => {
  const ai = getAIClient();
  const isDetailed = mode === 'detailed';

  const identityInstruction = `You are Ade AI. "Ade" means "Mother" (ኣደ) in Tigrinya. 
  You are a female AI assistant. Your persona is caring, wise, and supportive.
  GRAMMAR RULE: Always use the female form "ረዳኢት" (Redait) for yourself. Never use "ረዳኢ".
  If asked who you are, answer in ${TARGET_LANG}: "ኣነ ኣደ (Ade) AI እየ። ኣደ ማለት ብትግርኛ ወላዲት ማለት እዩ። ኣነ ንፉዕን ሓላይን ረዳኢትኩም እየ። ብሓገዝ ጀሚናይ (Gemini) ብዋናይ እየ ተፈጢረ።"`;

  const systemPrompt = isDetailed 
    ? `You are an advanced female AI assistant (Ade AI) performing deep search.
       ${identityInstruction}
       RULES:
       1. Provide comprehensive answers in ${TARGET_LANG}.
       2. Use the search tool to verify facts.
       3. Organize with detailed numbered steps.
       4. EVERY numbered item MUST start on a NEW LINE.
       5. Use feminine grammar when referring to yourself.
       Always respond in ${TARGET_LANG}.`
    : `You are a lightning-fast female AI assistant (Ade AI).
       ${identityInstruction}
       RULES:
       1. Respond in short, direct numbered steps.
       2. Every numbered item MUST start on a NEW LINE.
       3. Be extremely concise. Max speed.
       4. Use feminine grammar when referring to yourself.
       Always respond in ${TARGET_LANG}.`;

  const formattedHistory: any[] = [];
  for (const msg of history) {
    const role = msg.role === 'assistant' ? 'model' : 'user';
    const cleanText = msg.content.replace(/\*\*/g, '');
    const currentParts: any[] = [{ text: cleanText }];
    if (msg.image) {
      currentParts.push({ inlineData: { mimeType: 'image/jpeg', data: msg.image } });
    }
    const lastTurn = formattedHistory[formattedHistory.length - 1];
    if (lastTurn && lastTurn.role === role) {
      lastTurn.parts.push(...currentParts);
    } else {
      if (formattedHistory.length === 0 && role !== 'user') continue;
      formattedHistory.push({ role, parts: currentParts });
    }
  }

  try {
    const config: any = {
      systemInstruction: systemPrompt,
      thinkingConfig: { thinkingBudget: 0 }
    };

    if (isDetailed) {
      config.tools = [{ googleSearch: {} }];
    }

    const chat = ai.chats.create({
      model: 'gemini-3-flash-preview',
      history: formattedHistory,
      config: config
    });

    const result = await chat.sendMessageStream({ message: text });
    
    let fullText = "";
    let finalLinks: GroundingLink[] = [];

    for await (const chunk of result) {
      const textChunk = chunk.text || "";
      fullText += textChunk;
      onChunk(textChunk);

      const chunks = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (chunks) {
        const links = chunks
          .filter(c => c.web)
          .map(c => ({
            title: c.web?.title || 'Source',
            uri: c.web?.uri || ''
          }));
        if (links.length > 0) finalLinks = [...finalLinks, ...links];
      }
    }
    
    onComplete(finalLinks.length > 0 ? finalLinks : undefined);
  } catch (e) {
    console.error("Gemini Error:", e);
    onChunk("\n**👉 ርክብ ተቋሪጹ።**");
    onComplete();
  }
};
