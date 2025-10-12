import { DataManager } from './DataManager.js';

export class UIManager {
    static openPrivateChatWindows = new Map();
    static openGroupChatWindows = new Map();
    static gmMonitorWindow = null;
    static groupManagerWindow = null;
    static playerHubWindow = null; // FIX: Add a static property for the player hub

    static async openPlayerHub() {
        // FIX: Use and manage the static property for the player hub.
        if (this.playerHubWindow?.rendered) return this.playerHubWindow.bringToTop();
        const { PlayerHubWindow } = await import('./PlayerHubWindow.js');
        this.playerHubWindow = new PlayerHubWindow();
        return this.playerHubWindow.render(true);
    }

    static async openChatFor(userId) {
        const existingWindow = this.openPrivateChatWindows.get(userId);
        if (existingWindow?.rendered) return existingWindow.render(true);

        const chatKey = DataManager.getPrivateChatKey(game.user.id, userId);
        if (!DataManager.privateChats.has(chatKey)) {
            DataManager.addPrivateMessage(game.user.id, userId, {});
        }

        const { RunarWindow } = await import('./RunarWindow.js');
        const window = new RunarWindow({ otherUserId: userId });
        this.openPrivateChatWindows.set(userId, window);
        return window.render(true);
    }

    static async openGroupChat(groupId) {
        if (!DataManager.groupChats.has(groupId)) return;
        const existingWindow = this.openGroupChatWindows.get(groupId);
        if (existingWindow?.rendered) return existingWindow.render(true);

        const { RunarWindow } = await import('./RunarWindow.js');
        const window = new RunarWindow({ groupId: groupId });
        this.openGroupChatWindows.set(groupId, window);
        return window.render(true);
    }

    static async openGroupManager() {
        if (!game.user.isGM) return ui.notifications.error("This is a GM-only tool.");
        if (this.groupManagerWindow?.rendered) return this.groupManagerWindow.bringToTop();

        const { GroupManagerWindow } = await import('./GroupManagerWindow.js');
        this.groupManagerWindow = new GroupManagerWindow();
        return this.groupManagerWindow.render(true);
    }

    static async openGMMonitor() {
        if (!game.user.isGM) return ui.notifications.warn("You do not have permission.");
        if (this.gmMonitorWindow?.rendered) return this.gmMonitorWindow.bringToTop();

        const { GMMonitorWindow } = await import('./GMMonitorWindow.js');
        this.gmMonitorWindow = new GMMonitorWindow();
        return this.gmMonitorWindow.render(true);
    }

    static async openSettingsWindow() {
        const { SettingsWindow } = await import('./SettingsWindow.js');
        const id = 'runar-settings-window';
        if (Object.values(ui.windows).find(w => w.id === id)) return;
        new SettingsWindow().render(true);
    }
    
    static updateChatWindow(id, type) {
        if (type === 'private') this.openChatFor(id);
        else this.openGroupChat(id);
    }

    static closeChatWindow(id, type) {
        const window = (type === 'private') 
            ? this.openPrivateChatWindows.get(id) 
            : this.openGroupChatWindows.get(id);
        if (window) window.close();
    }
    
    static updateGroupManager() {
        if (this.groupManagerWindow?.rendered) {
            this.groupManagerWindow.render(true);
        }
    }

    // FIX: Add the update function for the player hub.
    static updatePlayerHub() {
        if (this.playerHubWindow?.rendered) {
            this.playerHubWindow.render(true);
        }
    }

    static updateGMMonitor() {
        if (this.gmMonitorWindow?.rendered) {
            this.gmMonitorWindow.render(true);
        }
    }
}