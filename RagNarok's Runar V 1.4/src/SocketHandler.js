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

    static _playNotificationSound() {
        const MODULE_ID = 'ragnaroks-runar';
        if (!game.settings.get(MODULE_ID, "enableSound")) return;
        
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
                if (recipientId !== game.user.id) break;

                if (isRelay && game.user.isGM) {
                    DataManager.addPrivateMessage(originalSenderId, originalRecipientId, message);
                    await DataManager.savePrivateChats();
                    const monitorPayload = { senderId: originalSenderId, recipientId: originalRecipientId, messageData: message };
                    DataManager.addInterceptedMessage(monitorPayload);
                    UIManager.updateGMMonitor();
                } 
                else if (!isRelay && isIncoming(message)) {
                    DataManager.addPrivateMessage(message.senderId, recipientId, message);
                    if (game.user.isGM) await DataManager.savePrivateChats();
                    this._playNotificationSound();
                    UIManager.updateChatWindow(message.senderId, 'private');
                }
                
                if (game.user.isGM) UIManager.updateGroupManager();
                // FIX: Tell the Player Hub to update its list.
                UIManager.updatePlayerHub();
                break;
            }
            case "groupMessage": {
                const { groupId, message } = data.payload;
                const group = DataManager.groupChats.get(groupId);

                if (group?.members.includes(game.user.id) && isIncoming(message)) {
                    DataManager.addGroupMessage(groupId, message);
                    if (game.user.isGM) await DataManager.saveGroupChats();
                    
                    this._playNotificationSound();
                    UIManager.updateChatWindow(groupId, 'group');

                    if (game.user.isGM) UIManager.updateGroupManager();
                    // FIX: Tell the Player Hub to update its list.
                    UIManager.updatePlayerHub();
                }
                break;
            }
            // FIX: Add a handler for when a new group is created.
            case "groupCreate": {
                const { group } = data.payload;
                if (group?.members.includes(game.user.id)) {
                    DataManager.groupChats.set(group.id, group);
                    // Tell the Player Hub to update with the new group.
                    UIManager.updatePlayerHub(); 
                }
                break;
            }
            case "groupDelete": { /* ... */ }
        }
    }
}