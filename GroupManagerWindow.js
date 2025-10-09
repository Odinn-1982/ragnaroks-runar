const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
import { DataManager } from './DataManager.js';
import { UIManager } from './UIManager.js';
import { SocketHandler } from './SocketHandler.js';

export class GroupManagerWindow extends HandlebarsApplicationMixin(ApplicationV2) {
  
    static DEFAULT_OPTIONS = {
        id: 'runar-group-manager',
        classes: ['ragnaroks-runar', 'group-manager-app'],
        window: { title: "RNR.GroupManagerTitle", resizable: true },
        tag: 'form',
        position: { width: 700, height: 500 }
    };

    get title() {
        return game.i18n.localize(this.options.window.title);
    }

    static PARTS = {
        form: { template: 'modules/ragnaroks-runar/templates/group-manager.hbs' }
    };

    async _prepareContext(options) {
        const conversations = [];
        const currentUser = game.user;

        for (const group of DataManager.groupChats.values()) {
            conversations.push({
                id: group.id,
                name: group.name,
                type: 'group',
                icon: 'fa-users',
                memberCount: group.members.length,
                history: group.messages || []
            });
        }

        for (const [key, chat] of DataManager.privateChats.entries()) {
            if (!chat.users || chat.users.length < 2 || (chat.history?.length ?? 0) === 0) continue;
            const user1 = game.users.get(chat.users[0]);
            const user2 = game.users.get(chat.users[1]);
            if (!user1 || !user2) continue;
            conversations.push({
                id: key,
                name: `${user1.name} & ${user2.name}`,
                type: 'private',
                icon: 'fa-user-secret',
                memberCount: 2,
                history: chat.history || []
            });
        }
        conversations.sort((a, b) => a.name.localeCompare(b.name));
        return {
            conversations: conversations,
            users: game.users.filter(u => u.active && u.id !== currentUser.id),
            isGM: currentUser.isGM
        };
    }

    _onRender(context, options) {
        super._onRender(context, options);
        // FIX: Reverted to the correct data-action attributes for the buttons.
        this.element.querySelector('[data-action="openSelected"]')?.addEventListener('click', () => this.openSelected());
        this.element.querySelector('[data-action="exportSelected"]')?.addEventListener('click', () => this.exportSelected());
        this.element.querySelector('[data-action="deleteSelected"]')?.addEventListener('click', () => this.deleteSelected());
        this.element.querySelector('[data-action="createGroup"]')?.addEventListener('click', () => this.createGroup());
    }

    _getSelected() {
        const selectedRadio = this.element.querySelector('input[name="selectedConversation"]:checked');
        if (!selectedRadio) {
            ui.notifications.warn("Please select a conversation first.");
            return null;
        }
        return selectedRadio.dataset;
    }

    async openSelected() {
        const selected = this._getSelected();
        if (!selected) return;

        if (selected.type === 'group') {
            UIManager.openGroupChat(selected.conversationId);
        } else {
            const chat = DataManager.privateChats.get(selected.conversationId);
            if (!chat) return ui.notifications.error("Could not find the selected private chat log.");
            const chatHistory = chat.history || [];
            const user1 = game.users.get(chat.users[0]);
            const user2 = game.users.get(chat.users[1]);
            const title = `Log: ${user1?.name || 'Unknown'} & ${user2?.name || 'Unknown'}`;
            const content = chatHistory.map(msg => {
                const time = new Date(msg.timestamp).toLocaleTimeString();
                return `<div><strong>[${time}] ${msg.senderName}:</strong> ${msg.messageContent}</div>`;
            }).join('');
            Dialog.prompt({
                title: title,
                content: `<div class="dialog-scrollable-log">${content || "No messages in this log."}</div>`,
                label: "Close",
                callback: () => {}
            });
        }
    }
    
    async exportSelected() {
        const selected = this._getSelected();
        if (!selected) return;

        let chatHistory, fileName;
        if (selected.type === 'group') {
            const group = DataManager.groupChats.get(selected.conversationId);
            chatHistory = group ? group.messages : [];
            fileName = `runar-log-group-${group.name.slugify()}.txt`;
        } else {
            const chat = DataManager.privateChats.get(selected.conversationId);
            chatHistory = chat ? chat.history : [];
            fileName = `runar-log-private-${selected.conversationId}.txt`;
        }

        const formattedLog = chatHistory.map(msg => {
            const time = new Date(msg.timestamp).toLocaleString();
            return `[${time}] ${msg.senderName}: ${msg.messageContent}`;
        }).join('\r\n');

        saveDataToFile(formattedLog, "text/plain", fileName);
        ui.notifications.info("Chat log exported.");
    }

    async deleteSelected() {
        const selected = this._getSelected();
        if (!selected) return;

        Dialog.confirm({
            title: "Delete Conversation Log",
            content: "<p>Are you sure you want to permanently delete this chat log? This cannot be undone.</p>",
            yes: async () => {
                if (selected.type === 'group') {
                    DataManager.groupChats.delete(selected.conversationId);
                    await DataManager.saveGroupChats();
                } else {
                    DataManager.privateChats.delete(selected.conversationId);
                    await DataManager.savePrivateChats();
                }
                ui.notifications.info("Conversation deleted.");
                this.render(true);
            },
            no: () => {},
            defaultYes: false
        });
    }

    async createGroup() {
        const form = this.element;
        const name = form.querySelector('input[name="newGroupName"]')?.value;
        if (!name?.trim()) return ui.notifications.warn("Please enter a group name.");
        
        const selectedUsers = Array.from(form.querySelectorAll('.user-checkbox:checked')).map(el => el.value);
        if (selectedUsers.length === 0) return ui.notifications.warn("Please select at least one member.");
        
        const allMemberIds = [...new Set([game.user.id, ...selectedUsers])];
        const newGroupId = foundry.utils.randomID();
        const newGroup = { id: newGroupId, name: name.trim(), members: allMemberIds, messages: [] };

        DataManager.groupChats.set(newGroupId, newGroup);
        await DataManager.saveGroupChats();
        
        ui.notifications.info(`Group "${name}" created.`);
        this.render(true);
        UIManager.openGroupChat(newGroupId);
    }
}