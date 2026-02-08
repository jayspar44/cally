import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';

/**
 * Check if running on a native platform (iOS/Android)
 */
export const isNative = () => Capacitor.isNativePlatform();

/**
 * Take a photo using the device camera (Native only)
 * Returns base64 string (without prefix) or null if cancelled/error
 */
export const takePhoto = async () => {
    try {
        const image = await Camera.getPhoto({
            quality: 80,
            allowEditing: false,
            resultType: CameraResultType.Base64,
            source: CameraSource.Prompt, // User chooses Camera or Photos
            width: 1024 // Resize to max width
        });

        return image.base64String;
    } catch (error) {
        // Ignore "User cancelled photos app" error
        if (error.message !== 'User cancelled photos app') {
            console.error('Camera error:', error);
        }
        return null;
    }
};
