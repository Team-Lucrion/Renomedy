import TextRecognition from '@react-native-ml-kit/text-recognition';
import { Platform } from 'react-native';

export type TextElement = {
  text: string;
  confidence?: number;
  boundingBox?: { left: number; top: number; width: number; height: number };
};

export type TextLine = {
  text: string;
  elements?: TextElement[];
  confidence?: number;
};

export type TextBlock = {
  text: string;
  lines: TextLine[];
};

export type OcrResult = {
  fullText: string;
  blocks: TextBlock[];
  confidence?: number;
  metadata: {
    mlkit_version: string;
    processing_time_ms: number;
    platform: string;
  };
};

export class MlKitTextRecognitionService {
  /**
   * Performs on-device text recognition using ML Kit v2.
   * Returns null if running in an unsupported environment or if recognition fails.
   */
  static async recognizeText(uri: string): Promise<OcrResult | null> {
    if (Platform.OS === 'web') {
      return null;
    }

    const startTime = Date.now();

    try {
      const result = await TextRecognition.recognize(uri);

      if (!result || !result.text) {
        return null;
      }

      return {
        fullText: result.text,
        blocks: result.blocks.map((block) => ({
          text: block.text,
          lines: block.lines.map((line) => ({
            text: line.text,
            confidence: (line as any).confidence,
            elements: (line as any).elements?.map((el: any) => ({
              text: el.text,
              confidence: el.confidence,
              boundingBox: el.frame,
            })),
          })),
        })),
        metadata: {
          mlkit_version: 'v2',
          processing_time_ms: Date.now() - startTime,
          platform: Platform.OS,
        },
      };
    } catch (error) {
      console.warn('[MlKitTextRecognitionService] extraction failed', error);
      return null;
    }
  }
}
