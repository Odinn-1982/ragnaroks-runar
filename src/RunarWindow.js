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
        classes: ['ragnaroks-runar', 'ragnaroks-runar-chat-window'],
        position: { width: 400, height: 450 },
        window: { resizable: true },
        tag: 'form',
        form: { closeOnSubmit: false }
    };

    static PARTS = {
        form: { template: `modules/ragnaroks-runar/templates/chat-window.hbs` }
    };

    async _prepareContext(options) {
        const context = { currentUser: game.user, isGM: game.user.isGM };
        if (context.isGM) {
            context.speakers = [
                { id: game.user.id, name: game.user.name, isActor: false },
                ...game.actors.filter(a => a.isOwner).map(a => ({ id: a.id, name: a.name, isActor: true }))
            ];
        }
        if (this.options.otherUserId) {
            const chatKey = DataManager.getPrivateChatKey(game.user.id, this.options.otherUserId);
            const chat = DataManager.privateChats.get(chatKey);
            Object.assign(context, {
                isGroup: false,
                otherUser: game.users.get(this.options.otherUserId),
                messages: chat ? chat.history : []
            });
        } else if (this.options.groupId) {
            const group = DataManager.groupChats.get(this.options.groupId);
            Object.assign(context, {
                isGroup: true,
                group: group,
                messages: group ? group.messages : []
            });
        }
        return context;
    }

    _onRender(context, options) {
        super._onRender(context, options);
        this.#scrollToBottom();

        this.element.addEventListener('submit', event => {
            event.preventDefault();
            const formData = new foundry.applications.ux.FormDataExtended(this.element);
            this._onSubmit(event, this.element, formData.object);
        });
    }

    async render(force, options) {
        await super.render(force, options);
        this.#scrollToBottom();
        return this;
    }

    #scrollToBottom() {
        const messageList = this.element.querySelector('.message-list');
        if (messageList) {
            messageList.scrollTop = messageList.scrollHeight;
        }
    }
  
    async _onSubmit(event, form, formData) {
        const message = formData.message;
        if (!message?.trim()) return;

        let speakerData = null;
        if (game.user.isGM) {
            const speakerId = formData.speaker;
            if (speakerId !== game.user.id) {
                const actor = game.actors.get(speakerId);
                if (actor) speakerData = { name: actor.name, img: actor.img };
            }
        }
        
        const senderId = game.user.id;
        const messageData = { 
            senderId: senderId, 
            senderName: speakerData ? speakerData.name : (game.user.name),
            senderImg: speakerData ? speakerData.img : game.user.avatar,
            messageContent: message, 
            timestamp: Date.now() 
        };

        if (this.options.otherUserId) {
            const recipientId = this.options.otherUserId;
            DataManager.addPrivateMessage(senderId, recipientId, messageData);
            SocketHandler.emit("privateMessage", { recipientId, message: messageData }, { recipients: [recipientId] });

            const recipientUser = game.users.get(recipientId);
            if (!game.user.isGM && recipientUser && !recipientUser.isGM) {
                const gm = game.users.find(u => u.isGM && u.active);
                if (gm) {
                    SocketHandler.emit("privateMessage", {
                        recipientId: gm.id, message: messageData, isRelay: true,
                        originalSenderId: senderId, originalRecipientId: recipientId
                    }, { recipients: [gm.id] });
                }
            } else if (game.user.isGM) {
                await DataManager.savePrivateChats();
            }
            // FIX: Replaced UIManager call with a direct render for more stability.
            this.render(true);
        } 
        else if (this.options.groupId) {
            const groupId = this.options.groupId;
            const group = DataManager.groupChats.get(groupId);
            if (!group) return;

            DataManager.addGroupMessage(groupId, messageData);
            const recipients = group.members.filter(id => id !== game.user.id);
            if (recipients.length > 0) {
                SocketHandler.emit("groupMessage", { groupId, message: messageData }, { recipients });
            }
             // FIX: Replaced UIManager call with a direct render for more stability.
            this.render(true);
            if (game.user.isGM) await DataManager.saveGroupChats();
        }

        const messageInput = form.querySelector('textarea[name="message"]');
        if (messageInput) {
            messageInput.value = '';
            messageInput.focus();
        }
    }
}