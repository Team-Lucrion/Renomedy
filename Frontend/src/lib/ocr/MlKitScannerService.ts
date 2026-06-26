import DocumentScanner from 'react-native-document-scanner-plugin';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

export type ScannerResult = {
  uri: string;
  width?: number;
  height?: number;
  metadata?: Record<string, any>;
};

export class MlKitScannerService {
  /**
   * Integrates ML Kit Document Scanner with a fallback to standard ImagePicker.
   */
  static async scanDocument(): Promise<ScannerResult | null> {
    try {
      // DocumentScanner only works on physical iOS/Android devices
      if (Platform.OS !== 'web') {
        const { scannedImages } = await DocumentScanner.scanDocument({
          maxNumPhotos: 1,
        });

        if (scannedImages && scannedImages.length > 0) {
          return {
            uri: scannedImages[0],
            metadata: {
              source: 'ml-kit-document-scanner',
              timestamp: new Date().toISOString(),
            },
          };
        }
      }
    } catch (error) {
      console.warn('[MlKitScannerService] native scanner failed or unavailable, falling back', error);
    }

    // Fallback to Expo ImagePicker
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      throw new Error('Camera permission required for scanning');
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true, // Manual cropping as fallback
      quality: 1,
    });

    if (result.canceled || !result.assets[0]) {
      return null;
    }

    const asset = result.assets[0];
    return {
      uri: asset.uri,
      width: asset.width,
      height: asset.height,
      metadata: {
        source: 'camera-fallback',
        timestamp: new Date().toISOString(),
      },
    };
  }
}
