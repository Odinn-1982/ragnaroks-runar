import { DataManager } from './DataManager.js';
import { UIManager } from './UIManager.js';

export class SocketHandler {
    static SOCKET_NAME = 'module.ragnaroks-runar';

    static initialize() {
        game.socket.on(this.SOCKET_NAME, (data) => this._onSocketMessage(data));
    }

    static emit(type, payload, options = {}) {
        game.socket.emit(this.SOCKET_NAME, { type, payload }, options);
    }

    // FIX: Sound logic is moved here to be self-contained.
    static _playNotificationSound() {
        const MODULE_ID = 'ragnaroks-runar';
        if (!game.settings.get(MODULE_ID, "enableSound")) return;
        
        // This sound logic was moved from RagnaroksRunar.js
        const soundPath = game.settings.get(MODULE_ID, "gmOverrideEnabled")
            ? game.settings.get(MODULE_ID, "gmOverrideSoundPath")
            : game.settings.get(MODULE_ID, "notificationSound");
        const volume = game.settings.get(MODULE_ID, "notificationVolume");
        foundry.audio.AudioHelper.play({ src: soundPath, volume: volume, autoplay: true, loop: false }, false);
    }

    static async _onSocketMessage(data) {
        const isIncoming = (message) => message.senderId !== game.user.id;

        switch (data.type) {
            case "privateMessage": {
                const { recipientId, message, isRelay, originalSenderId, originalRecipientId } = data.payload;
                if (recipientId !== game.user.id || !isIncoming(message)) break;

                if (isRelay && game.user.isGM) {
                    DataManager.addPrivateMessage(originalSenderId, originalRecipientId, message);
                    await DataManager.savePrivateChats();
                    const monitorPayload = {
                        senderId: originalSenderId,
                        recipientId: originalRecipientId,
                        messageData: message
                    };
                    DataManager.addInterceptedMessage(monitorPayload);
                    UIManager.updateGMMonitor();
                } 
                else if (!isRelay) {
                    DataManager.addPrivateMessage(message.senderId, recipientId, message);
                    if (game.user.isGM) await DataManager.savePrivateChats();
                    
                    // FIX: Call the local sound function and the window-opening function.
                    this._playNotificationSound();
                    UIManager.updateChatWindow(message.senderId, 'private');
                }
                break;
            }
            case "groupMessage": {
                const { groupId, message } = data.payload;
                const group = DataManager.groupChats.get(groupId);
                if (group?.members.includes(game.user.id) && isIncoming(message)) {
                    DataManager.addGroupMessage(groupId, message);
                    if (game.user.isGM) await DataManager.saveGroupChats();
                    
                    // FIX: Call the local sound function and the window-opening function.
                    this._playNotificationSound();
                    UIManager.updateChatWindow(groupId, 'group');
                }
                break;
            }
            // ... other cases remain the same
            case "groupCreate": { /* ... */ }
            case "groupDelete": { /* ... */ }
        }
    }
}