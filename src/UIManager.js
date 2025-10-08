import { DataManager } from './DataManager.js';

export class UIManager {
    static openPrivateChatWindows = new Map();
    static openGroupChatWindows = new Map();
    static gmMonitorWindow = null;

    static async openPlayerHub() {
        const { PlayerHubWindow } = await import('./PlayerHubWindow.js');
        const id = 'runar-player-hub';
        if (Object.values(ui.windows).find(w => w.id === id)) return;
        new PlayerHubWindow().render(true);
    }

    static async openChatFor(userId) {
        const existingWindow = this.openPrivateChatWindows.get(userId);
        if (existingWindow?.rendered) return existingWindow.render(true);

        const chatKey = DataManager.getPrivateChatKey(game.user.id, userId);
        if (!DataManager.privateChats.has(chatKey)) {
            DataManager.addPrivateMessage(game.user.id, userId, {});
            // FIX: This is the critical line that saves the new chat, fixing the bug.
            if (game.user.isGM) await DataManager.savePrivateChats();
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
        const { GroupManagerWindow } = await import('./GroupManagerWindow.js');
        const id = 'runar-group-manager';
        if (Object.values(ui.windows).find(w => w.id === id)) return;
        new GroupManagerWindow().render(true);
    }

    static async openGMMonitor() {
        if (!game.user.isGM) return ui.notifications.warn("You do not have permission.");
        
        if (this.gmMonitorWindow?.rendered) {
            return this.gmMonitorWindow.bringToTop();
        }

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
        const groupManager = Object.values(ui.windows).find(w => w.id === 'runar-group-manager');
        if (groupManager) groupManager.render(true);
    }

    static updateGMMonitor() {
        if (this.gmMonitorWindow?.rendered) {
            this.gmMonitorWindow.render(true);
        }
    }
}