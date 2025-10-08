import { DataManager } from './DataManager.js';
import { SocketHandler } from './SocketHandler.js';
import { UIManager } from './UIManager.js';

export class RagnaroksRunar {
    static ID = 'ragnaroks-runar';
    static NAME = "RagNarok's Rúnar";
    // REMOVED the static SOUNDS object.

    static initialize() {
        DataManager.loadGroupChats();
        DataManager.loadPrivateChats();
        SocketHandler.initialize();
        console.log(`${this.NAME} | Initialized and ready.`);
    }
    
    static async sendMessage(recipientId, messageContent, speakerData = null) {
        const senderId = game.user.id;
        const messageData = { 
            senderId: senderId, 
            senderName: speakerData ? speakerData.name : game.user.name,
            senderImg: speakerData ? speakerData.img : game.user.avatar,
            messageContent: messageContent, 
            timestamp: Date.now() 
        };
        DataManager.addPrivateMessage(senderId, recipientId, messageData);
        SocketHandler.emit("privateMessage", { recipientId, message: messageData }, { recipients: [recipientId] });

        const recipientUser = game.users.get(recipientId);
        if (!game.user.isGM && recipientUser && !recipientUser.isGM) {
            const gm = game.users.find(u => u.isGM && u.active);
            if (gm) {
                SocketHandler.emit("privateMessage", {
                    recipientId: gm.id,
                    message: messageData,
                    isRelay: true,
                    originalSenderId: senderId,
                    originalRecipientId: recipientId
                }, { recipients: [gm.id] });
            }
        } else if (game.user.isGM) {
            await DataManager.savePrivateChats();
        }
        UIManager.updateChatWindow(recipientId, 'private');
    }
}