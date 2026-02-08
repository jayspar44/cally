import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { logger } from './logger';

export const isNative = () => Capacitor.isNativePlatform();

export const takePhoto = async () => {
    try {
        const image = await Camera.getPhoto({
            quality: 80,
            allowEditing: false,
            resultType: CameraResultType.Base64,
            source: CameraSource.Prompt,
            width: 1024,
        });

        return image.base64String;
    } catch (error) {
        if (error.message !== 'User cancelled photos app') {
            logger.error('Camera error:', error);
        }
        return null;
    }
};
