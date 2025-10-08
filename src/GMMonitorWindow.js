const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
import { DataManager } from './DataManager.js';
import { UIManager } from './UIManager.js';

export class GMMonitorWindow extends HandlebarsApplicationMixin(ApplicationV2) {

    static DEFAULT_OPTIONS = {
        id: 'runar-gm-monitor',
        classes: ['ragnaroks-runar'],
        position: { width: 600, height: 500 },
        window: { resizable: true }
    };

    get title() {
        return "Rúnar GM Monitor";
    }

    static PARTS = {
        body: { template: `modules/ragnaroks-runar/templates/gm-monitor.hbs` }
    };

    async _prepareContext(options) {
        const messages = DataManager.interceptedMessages.map(msg => {
            const sender = game.users.get(msg.senderId);
            const recipient = game.users.get(msg.recipientId);
            
            const timestamp = new Date(msg.messageData.timestamp);
            const formattedTimestamp = timestamp.toLocaleTimeString([], {
                hour: '2-digit', minute: '2-digit', second: '2-digit'
            });

            return {
                ...msg.messageData,
                id: msg.id,
                senderName: sender ? sender.name : "Unknown",
                senderImg: sender ? sender.avatar : "icons/svg/mystery-man.svg",
                recipientName: recipient ? recipient.name : "Unknown",
                recipientImg: recipient ? recipient.avatar : "icons/svg/mystery-man.svg",
                speakerName: msg.messageData.senderName,
                formattedTime: formattedTimestamp
            };
        }).reverse();
        return { interceptedMessages: messages };
    }

    _onRender(context, options) {
        super._onRender(context, options);
        this.element.querySelector('[data-action="open-group-manager"]')?.addEventListener('click', () => {
            UIManager.openGroupManager();
        });
        this.element.querySelector('[data-action="open-settings"]')?.addEventListener('click', () => {
            UIManager.openSettingsWindow();
        });
    }

    async close(options) {
        UIManager.gmMonitorWindow = null;
        return super.close(options);
    }
}