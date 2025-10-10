const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
import { DataManager } from './DataManager.js';
import { UIManager } from './UIManager.js';
import { SocketHandler } from './SocketHandler.js';

export class RunarWindow extends HandlebarsApplicationMixin(ApplicationV2) {

    get id() {
        const base = 'runar-window';
        if (this.options.groupId) return `${base}-group-${this.options.groupId}`;
        if (this.options.otherUserId) return `${base}-private-${this.options.otherUserId}`;
        return `${base}-${foundry.utils.randomID()}`;
    }

    get title() {
        if (this.options.groupId) {
            const group = DataManager.groupChats.get(this.options.groupId);
            return group ? game.i18n.format("RNR.GroupChat", {name: group.name}) : game.i18n.localize("RNR.GroupChatDefault");
        }
        if (this.options.otherUserId) {
            const otherUser = game.users.get(this.options.otherUserId);
            return otherUser ? game.i18n.format("RNR.ChatWith", {name: otherUser.name}) : game.i18n.localize("RNR.PrivateChat");
        }
        return game.i18n.localize("RNR.AppName");
    }

    static DEFAULT_OPTIONS = {
        classes: ['ragnaroks-runar', 'chat-app'],
        window: { title: "RNR.AppName", resizable: true },
        position: { width: 400, height: 600 },
        tag: 'form',
        form: { 
            handler: RunarWindow.#onFormSubmit, 
            closeOnSubmit: false 
        } 
    };

    static PARTS = {
        form: { template: 'modules/ragnaroks-runar/templates/chat-window.hbs' }
    };

    async _prepareContext(options) {
        const context = super._prepareContext(options);
        const isGM = game.user.isGM;
        let messages = [];

        if (this.options.otherUserId) {
            const chatKey = DataManager.getPrivateChatKey(game.user.id, this.options.otherUserId);
            const chat = DataManager.privateChats.get(chatKey);
            messages = chat?.history || [];
        } else if (this.options.groupId) {
            const group = DataManager.groupChats.get(this.options.groupId);
            messages = group?.messages || [];
        }
        
        // The speaker list includes all active users for GMs to choose from.
        const speakers = game.users
            .filter(u => u.active && (u.isGM || game.user.id === u.id))
            .map(u => ({ id: u.id, name: u.name }));
            
        // Add current user to context for template checks
        context.currentUser = game.user;
        context.messages = messages;
        context.isGM = isGM;
        context.speakers = speakers;

        return context;
    }

    _onRender(context, options) {
        super._onRender(context, options);
        // Scroll to the bottom of the message list on render
        const messageList = this.element.find('.message-list')[0];
        if (messageList) {
            messageList.scrollTop = messageList.scrollHeight;
        }
        // Focus the input field
        this.element.find('textarea[name="message"]').focus();
    }
    
    async close(options) {
        if (this.options.otherUserId) {
            UIManager.openPrivateChatWindows.delete(this.options.otherUserId);
        } else if (this.options.groupId) {
            UIManager.openGroupChatWindows.delete(this.options.groupId);
        }
        return super.close(options);
    }
    
    /**
     * Handles the form submission for sending a message.
     * @param {Event} event 
     * @param {HTMLFormElement} form 
     * @param {object} formData - The parsed form data object from ApplicationV2
     */
    static async #onFormSubmit(event, form, formData) {
        event.preventDefault();

        // FIX 1 (Line 72): Resolves the 'FormDataExtended' TypeError.
        // Use the formData.object property directly from the ApplicationV2 handler.
        const data = formData.object; 
        
        const message = data.message?.trim();
        if (!message) return;

        const senderId = game.user.id;

        // 2. Determine the Speaker (Crucial for GM)
        let speakerId = senderId;
        const speakerSelect = form.querySelector('select[name="speaker"]');
        if (game.user.isGM && speakerSelect) {
            speakerId = speakerSelect.value;
        }

        const speakerUser = game.users.get(speakerId) ?? game.user; 
        
        const messageData = { 
            senderId: senderId, 
            speakerId: speakerId, 
            senderName: speakerUser.name,
            senderImg: speakerUser.avatar,
            messageContent: message, 
            timestamp: Date.now() 
        };

        // Get a reference to the window instance to call render(true)
        const windowInstance = Object.values(ui.windows).find(w => w.element?.is(form.closest('.window-app')));
        if (!windowInstance) return;


        // --- Private Chat Logic ---
        if (windowInstance.options.otherUserId) {
            const recipientId = windowInstance.options.otherUserId;
            
            DataManager.addPrivateMessage(senderId, recipientId, messageData);
            
            // FIX 2: Emit to BOTH the sender and the recipient for reliable UI update via socket (critical for GMs).
            SocketHandler.emit("privateMessage", { recipientId, message: messageData }, { recipients: [senderId, recipientId] }); 
            
            const recipientUser = game.users.get(recipientId);
            
            if (game.user.isGM) {
                // If sender is GM, save for persistence
                await DataManager.savePrivateChats();
                
            } else if (recipientUser && !recipientUser.isGM) {
                // Player-to-Player Relay Logic
                const gm = game.users.find(u => u.isGM && u.active);
                if (gm) {
                    SocketHandler.emit("privateMessage", {
                        recipientId: gm.id, message: messageData, isRelay: true,
                        originalSenderId: senderId, originalRecipientId: recipientId
                    }, { recipients: [gm.id] });
                }
            } 
            
        } 
        
        // --- Group Chat Logic ---
        else if (windowInstance.options.groupId) {
            const groupId = windowInstance.options.groupId;
            const group = DataManager.groupChats.get(groupId);
            if (!group) return;

            DataManager.addGroupMessage(groupId, messageData);
            
            // FIX 3: Emit to ALL group members to ensure everyone, including sender, receives update.
            if (group.members.length > 0) {
                SocketHandler.emit("groupMessage", { groupId, message: messageData }, { recipients: group.members }); 
            }
            
            if (game.user.isGM) await DataManager.saveGroupChats();
        }

        // Final UI Updates
        windowInstance.render(true);

        const messageInput = form.querySelector('textarea[name="message"]');
        if (messageInput) {
            messageInput.value = '';
            messageInput.focus();
        }
    }
}