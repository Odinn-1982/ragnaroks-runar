export class DataManager {
    static ID = 'ragnaroks-runar';
    static privateChats = new Map();
    static groupChats = new Map();
    static interceptedMessages = [];

    static getPrivateChatKey(userId1, userId2) {
        return [userId1, userId2].sort().join('-');
    }

    static async loadGroupChats() {
        const groupsData = game.settings.get(this.ID, 'groupChats') || {};
        this.groupChats = new Map(Object.entries(groupsData));
    }

    static async loadPrivateChats() {
        const chatsData = game.settings.get(this.ID, 'privateChats') || {};
        this.privateChats = new Map(Object.entries(chatsData));
    }

    static async saveGroupChats() {
        if (!game.user.isGM) return;
        await game.settings.set(this.ID, 'groupChats', Object.fromEntries(this.groupChats));
    }

    static async savePrivateChats() {
        if (!game.user.isGM) return;
        await game.settings.set(this.ID, 'privateChats', Object.fromEntries(this.privateChats));
    }

    static addPrivateMessage(userId1, userId2, messageData) {
        const chatKey = this.getPrivateChatKey(userId1, userId2);
        if (!this.privateChats.has(chatKey)) {
            this.privateChats.set(chatKey, { users: [userId1, userId2], history: [] });
        }
        if (messageData && Object.keys(messageData).length > 0) {
            this.privateChats.get(chatKey).history.push(messageData);
        }
    }

    // FIX: Added the missing function back into the file.
    static addGroupMessage(groupId, messageData) {
        const group = this.groupChats.get(groupId);
        if (group) {
            if (!group.messages) group.messages = [];
            group.messages.push(messageData);
        }
    }
    
    static addInterceptedMessage(payload) {
        payload.id = foundry.utils.randomID();
        this.interceptedMessages.push(payload);
        if (this.interceptedMessages.length > 50) this.interceptedMessages.shift();
    }
}