import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';

/**
 * Sound Manager for React Native
 * Uses expo-haptics for tactile feedback since generating tones
 * requires native modules. For production, consider adding actual
 * sound files in assets/sounds/
 */
class SoundManager {
  private enabled: boolean = true;

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  isEnabled() {
    return this.enabled;
  }

  async playBuy() {
    if (!this.enabled) return;
    try {
      // Success haptic for buy action
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.warn('Haptics not available:', error);
    }
  }

  async playSell() {
    if (!this.enabled) return;
    try {
      // Warning haptic for sell action
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch (error) {
      console.warn('Haptics not available:', error);
    }
  }

  async playNews() {
    if (!this.enabled) return;
    try {
      // Light impact for news notification
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.warn('Haptics not available:', error);
    }
  }

  async playError() {
    if (!this.enabled) return;
    try {
      // Error haptic
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } catch (error) {
      console.warn('Haptics not available:', error);
    }
  }

  async playWin() {
    if (!this.enabled) return;
    try {
      // Heavy impact for winning
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      setTimeout(async () => {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }, 100);
    } catch (error) {
      console.warn('Haptics not available:', error);
    }
  }

  async playSlotSpin() {
    if (!this.enabled) return;
    try {
      // Selection feedback for slot spin
      await Haptics.selectionAsync();
    } catch (error) {
      console.warn('Haptics not available:', error);
    }
  }

  async playCardFlip() {
    if (!this.enabled) return;
    try {
      // Soft impact for card flip
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
    } catch (error) {
      console.warn('Haptics not available:', error);
    }
  }

  async playTap() {
    if (!this.enabled) return;
    try {
      // Light selection for general taps
      await Haptics.selectionAsync();
    } catch (error) {
      console.warn('Haptics not available:', error);
    }
  }
}

export const sounds = new SoundManager();
