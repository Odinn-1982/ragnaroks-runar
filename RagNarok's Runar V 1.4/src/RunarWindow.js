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
        classes: ['ragnaroks-runar', 'runar-chat-app'],
        window: { resizable: true },
        tag: 'form', // Set as form element for ApplicationV2 form handling
        form: {
            handler: RunarWindow.#onFormSubmit, // V12 Form Handler (The Fix)
            closeOnSubmit: false // Do not close the window on message send
        },
        position: { width: 400, height: 600 }
    };

    static PARTS = {
        form: { template: 'modules/ragnaroks-runar/templates/chat-window.hbs' }
    };

    /**
     * Prepare context data for the chat window template.
     */
    async _prepareContext(options) {
        const context = {
            currentUser: game.user,
            messages: [],
            isGM: game.user.isGM
        };

        if (this.options.groupId) {
            const group = DataManager.groupChats.get(this.options.groupId);
            context.messages = group?.messages || [];
        } else if (this.options.otherUserId) {
            const chatKey = DataManager.getPrivateChatKey(game.user.id, this.options.otherUserId);
            const chat = DataManager.privateChats.get(chatKey);
            context.messages = chat?.history || [];
        }

        // If GM, load list of speakers (Users and Actors for 'Speak As' functionality)
        if (game.user.isGM) {
            context.speakers = [{ id: game.user.id, name: game.user.name }];
            for (const actor of game.actors) {
                // Only allow speaking as actors/tokens that the GM has access to
                if (actor.isOwner) { 
                     context.speakers.push({ id: actor.id, name: actor.name });
                }
            }
        }
        
        return context;
    }

    /**
     * Scroll to the bottom of the message list after rendering.
     */
    _onRender(context, options) {
        super._onRender(context, options);
        // Find the message-list element and scroll to the bottom
        const messageList = this.element.querySelector('.message-list');
        if (messageList) {
            messageList.scrollTop = messageList.scrollHeight;
        }
    }

    /**
     * Handle form submission for chat messages. (THE CRITICAL FIX FOR V12)
     * @param {Event} event - The submission event.
     * @param {HTMLFormElement} form - The form element itself.
     * @param {object} formData - The parsed form data provided by ApplicationV2.
     */
    static async #onFormSubmit(event, form, formData) {
        // Retrieve the actual application instance from the DOM element
        const windowInstance = form.closest('.app')?.application;
        if (!windowInstance) return;
        
        // FIX: Directly access the parsed message content from formData.object
        const messageContent = formData.object.message;
        if (!messageContent.trim()) return;

        const senderId = game.user.id;
        
        // Get speaker ID from the select (if GM) or default to the sender
        const speakerId = formData.object.speaker ?? senderId;

        const speakerData = speakerId === senderId 
            ? null // Speaking as self (user)
            : game.actors.get(speakerId)?.token || game.users.get(speakerId); 

        const messageData = { 
            senderId: senderId, 
            senderName: speakerData ? speakerData.name : game.user.name,
            senderImg: speakerData ? speakerData.img : game.user.avatar,
            messageContent: messageContent, 
            timestamp: Date.now() 
        };

        // --- Private Chat Logic ---
        if (windowInstance.options.otherUserId) {
            const recipientId = windowInstance.options.otherUserId;
            
            DataManager.addPrivateMessage(senderId, recipientId, messageData);
            
            const recipientUser = game.users.get(recipientId);

            // Send to the other user (and yourself if not GM)
            const recipients = [recipientId];
            if (!game.user.isGM) recipients.push(game.user.id);
            SocketHandler.emit("privateMessage", { recipientId, message: messageData }, { recipients });

            // Relay to GM Logic (if player-to-player)
            if (!game.user.isGM && recipientUser && !recipientUser.isGM) {
                const gm = game.users.find(u => u.isGM && u.active);
                if (gm) {
                    SocketHandler.emit("privateMessage", {
                        recipientId: gm.id, message: messageData, isRelay: true,
                        originalSenderId: senderId, originalRecipientId: recipientId
                    }, { recipients: [gm.id] });
                }
            } 
            
            if (game.user.isGM) await DataManager.savePrivateChats();
        } 
        
        // --- Group Chat Logic ---
        else if (windowInstance.options.groupId) {
            const groupId = windowInstance.options.groupId;
            const group = DataManager.groupChats.get(groupId);
            if (!group) return;

            DataManager.addGroupMessage(groupId, messageData);
            
            // Send to all group members
            if (group.members.length > 0) {
                SocketHandler.emit("groupMessage", { groupId, message: messageData }, { recipients: group.members }); 
            }
            
            if (game.user.isGM) await DataManager.saveGroupChats();
        }

        // Final UI Updates
        // Render the window to show the new message and automatically scroll to bottom
        windowInstance.render(false); 
        
        // Clear the message input and re-focus
        const messageInput = form.querySelector('textarea[name="message"]');
        if (messageInput) {
            messageInput.value = '';
            messageInput.focus();
        }
    }

    async close(options) {
        // Clean up the UIManager's map when the window is closed
        if (this.options.groupId) UIManager.openGroupChatWindows.delete(this.options.groupId);
        if (this.options.otherUserId) UIManager.openPrivateChatWindows.delete(this.options.otherUserId);
        return super.close(options);
    }
}