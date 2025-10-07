const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
import { DataManager } from './DataManager.js';
import { UIManager } from './UIManager.js';
import { SocketHandler } from './SocketHandler.js';

export class PlayerHubWindow extends HandlebarsApplicationMixin(ApplicationV2) {
  
  static DEFAULT_OPTIONS = {
    id: 'runar-player-hub',
    classes: ['ragnaroks-runar', 'player-hub-app'],
    window: { title: "RNR.PlayerHubTitle", resizable: true },
    tag: 'form',
    position: { width: 600, height: 450 } // FIX: Changed height from "auto" to a fixed value
  };

  get title() {
    return game.i18n.localize(this.options.window.title);
  }

  static PARTS = {
    form: { template: 'modules/ragnaroks-runar/templates/player-hub.hbs' }
  };

  async _prepareContext(options) {
    const conversations = [];
    const currentUser = game.user;

    const visibleGroups = Array.from(DataManager.groupChats.values()).filter(g => g.members.includes(currentUser.id));
    for (const group of visibleGroups) {
        conversations.push({ id: group.id, name: group.name, type: 'group', icon: 'fa-users', memberCount: group.members.length });
    }

    const visiblePrivateChats = Array.from(DataManager.privateChats.values()).filter(chat => chat.users && chat.users.includes(currentUser.id));
    for (const chat of visiblePrivateChats) {
        const otherUserId = chat.users.find(id => id !== currentUser.id);
        const otherUser = game.users.get(otherUserId);
        if (!otherUser) continue;
        conversations.push({
            id: DataManager.getPrivateChatKey(chat.users[0], chat.users[1]),
            name: `Chat with ${otherUser.name}`,
            type: 'private',
            icon: 'fa-user',
            memberCount: 2
        });
    }
    conversations.sort((a, b) => a.name.localeCompare(b.name));
    
    return {
        conversations: conversations,
        users: game.users.filter(u => u.id !== currentUser.id && u.active),
        isGM: false
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    this.element.querySelector('[data-action="openSelected"]')?.addEventListener('click', event => this.openSelected(event));
    this.element.querySelector('[data-action="createGroup"]')?.addEventListener('click', event => this.createGroup(event));
  }

  async openSelected() {
    const selectedCheckbox = this.element.querySelector('.conversation-checkbox:checked');
    if (!selectedCheckbox) return ui.notifications.warn("Please select a chat to open.");
    
    const id = selectedCheckbox.dataset.conversationId;
    const type = selectedCheckbox.dataset.type;

    if (type === 'group') UIManager.openGroupChat(id);
    else if (type === 'private') {
        const userIds = id.split('-');
        const otherUserId = userIds.find(uid => uid !== game.user.id);
        if (otherUserId) UIManager.openChatFor(otherUserId);
    }
    this.close();
  }

  async createGroup() {
    const form = this.element;
    const name = form.querySelector('input[name="newGroupName"]')?.value;
    const selectedUsers = Array.from(form.querySelectorAll('.user-checkbox:checked')).map(el => el.value);

    if (!name.trim() && selectedUsers.length === 1) {
        UIManager.openChatFor(selectedUsers[0]);
        this.close();
        return;
    }

    if (!name.trim() && selectedUsers.length > 1) {
      return ui.notifications.warn("Please enter a name for a group chat with multiple people.");
    }
    
    const newGroupId = foundry.utils.randomID();
    const allMemberIds = [...new Set([game.user.id, ...selectedUsers])];
    const newGroup = { 
        id: newGroupId, 
        name: name, 
        members: allMemberIds, 
        messages: [] 
    };

    DataManager.groupChats.set(newGroupId, newGroup);

    if (game.user.isGM) await DataManager.saveGroupChats();
    
    SocketHandler.emit("groupCreate", { group: newGroup });
    
    UIManager.openGroupChat(newGroupId);
    
    this.close();
  }
}