import { FunctionDeclaration, GoogleGenAI, LiveServerMessage, Modality, Type } from "@google/genai";
import { createPcmBlob, decodeAudio, decodeAudioData } from "../utils/audioUtils";
import { CropListing } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

// --- Static Content Generation (Market Insights) ---

export const getMarketInsight = async (crop: string, location: string, lang: string) => {
    try {
        const prompt = `
      Act as an Indian agricultural expert.
      Provide a short market insight for ${crop} in ${location}.
      Output JSON with: recommendedPrice (number), trend ('up' or 'down'), and advice (string in ${lang} language, max 20 words).
      The advice should be simple for a farmer.
    `;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        recommendedPrice: { type: Type.NUMBER },
                        trend: { type: Type.STRING },
                        advice: { type: Type.STRING }
                    }
                }
            }
        });

        return JSON.parse(response.text || '{}');
    } catch (error) {
        console.error("Error fetching market insight", error);
        return { recommendedPrice: 0, trend: 'stable', advice: 'Unable to fetch data.' };
    }
};

export const translateText = async (text: string, targetLang: string) => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Translate the following text to ${targetLang}. Only return the translated string. Text: "${text}"`
        });
        return response.text?.trim() || text;
    } catch (e) {
        return text;
    }
}

export const transliterateToEnglish = async (text: string) => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash-lite-preview-02-05',
            contents: `Convert the following name to English script (latin alphabet). If it's already in English, return it as is. Do not translate the meaning, just transliterate the sound. Return ONLY the English name. Input: "${text}"`
        });
        return response.text?.trim() || text;
    } catch (e) {
        console.error("Transliteration failed", e);
        return text;
    }
}


// --- Live API Hook Logic ---

export interface LiveSessionController {
    connect: () => Promise<void>;
    disconnect: () => void;
    sendAudioChunk: (data: Float32Array) => void;
    isPlaying: boolean;
    isListening: boolean;
}

export const createLiveSession = (
    onAudioOutput: (isPlaying: boolean) => void,
    onTranscription: (text: string, isFinal: boolean) => void,
    systemInstruction: string,
    tools?: FunctionDeclaration[],
    onToolCall?: (name: string, args: any) => Promise<any>
): LiveSessionController => {

    let nextStartTime = 0;
    const inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    const outputNode = outputAudioContext.createGain();
    outputNode.connect(outputAudioContext.destination);

    const sources = new Set<AudioBufferSourceNode>();
    let sessionPromise: Promise<any> | null = null;
    let stream: MediaStream | null = null;
    let scriptProcessor: ScriptProcessorNode | null = null;
    let isActive = false;

    const disconnect = () => {
        isActive = false;
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
        }
        if (scriptProcessor) {
            scriptProcessor.disconnect();
            scriptProcessor = null;
        }
        sources.forEach(s => s.stop());
        sources.clear();

        // Close session if possible (wrapper logic)
        // Since we can't easily cancel the sessionPromise, we assume wrapper handles cleanup
    };

    const connect = async () => {
        isActive = true;

        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            sessionPromise = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-12-2025',
                config: {
                    responseModalities: [Modality.AUDIO],
                    systemInstruction: systemInstruction,
                    speechConfig: {
                        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
                    },
                    tools: tools ? [{ functionDeclarations: tools }] : undefined,
                    outputAudioTranscription: {},
                    inputAudioTranscription: {}, // Enable user transcription
                },
                callbacks: {
                    onopen: () => {
                        console.log("Gemini Live Connected");

                        // Setup Audio Input Stream
                        const source = inputAudioContext.createMediaStreamSource(stream!);
                        scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);

                        scriptProcessor.onaudioprocess = (e) => {
                            if (!isActive) return;
                            const inputData = e.inputBuffer.getChannelData(0);
                            const pcmBlob = createPcmBlob(inputData);

                            sessionPromise?.then(session => {
                                session.sendRealtimeInput({ media: pcmBlob });
                            });
                        };

                        source.connect(scriptProcessor);
                        scriptProcessor.connect(inputAudioContext.destination);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        if (!isActive) return;

                        // Handle Transcription (User Input)
                        if (message.serverContent?.inputTranscription?.text) {
                            // Optionally handle user input transcription if needed
                        }

                        // Handle Transcription (Model Output)
                        if (message.serverContent?.outputTranscription?.text) {
                            onTranscription(message.serverContent.outputTranscription.text, false);
                        }
                        if (message.serverContent?.turnComplete) {
                            onTranscription("", true); // Signal turn complete
                        }

                        // Handle Function Calls (Tools)
                        if (message.toolCall && onToolCall) {
                            const responses = [];
                            for (const fc of message.toolCall.functionCalls) {
                                console.log(`Tool Call: ${fc.name}`, fc.args);
                                try {
                                    const result = await onToolCall(fc.name, fc.args);
                                    responses.push({
                                        id: fc.id,
                                        name: fc.name,
                                        response: { result: result }
                                    });
                                } catch (err: any) {
                                    responses.push({
                                        id: fc.id,
                                        name: fc.name,
                                        response: { error: err.message }
                                    });
                                }
                            }
                            sessionPromise?.then(session => {
                                session.sendToolResponse({ functionResponses: responses });
                            });
                        }

                        // Handle Audio Output
                        const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                        if (base64Audio) {
                            onAudioOutput(true);
                            nextStartTime = Math.max(nextStartTime, outputAudioContext.currentTime);

                            const audioBuffer = await decodeAudioData(
                                decodeAudio(base64Audio),
                                outputAudioContext,
                                24000,
                                1
                            );

                            const source = outputAudioContext.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(outputNode);
                            source.addEventListener('ended', () => {
                                sources.delete(source);
                                if (sources.size === 0) onAudioOutput(false);
                            });

                            source.start(nextStartTime);
                            nextStartTime += audioBuffer.duration;
                            sources.add(source);
                        }

                        const interrupted = message.serverContent?.interrupted;
                        if (interrupted) {
                            sources.forEach(s => s.stop());
                            sources.clear();
                            nextStartTime = 0;
                            onAudioOutput(false);
                        }
                    },
                    onclose: () => {
                        console.log("Gemini Live Closed");
                    },
                    onerror: (err) => {
                        console.error("Gemini Live Error", err);
                    }
                }
            });

            await sessionPromise;

        } catch (error) {
            console.error("Connection failed", error);
            isActive = false;
        }
    };

    return {
        connect,
        disconnect,
        sendAudioChunk: () => { }, // Handled internally via scriptProcessor
        isPlaying: false,
        isListening: isActive
    };
};