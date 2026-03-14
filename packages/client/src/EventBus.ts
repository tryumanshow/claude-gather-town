import Phaser from 'phaser';

// Singleton EventBus for React ↔ Phaser communication
export const EventBus = new Phaser.Events.EventEmitter();
