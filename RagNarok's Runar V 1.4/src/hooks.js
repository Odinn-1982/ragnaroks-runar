import { RagnaroksRunar } from './RagnaroksRunar.js';
import { UIManager } from './UIManager.js';

Hooks.once('init', () => {
    window.RagnaroksRunar = RagnaroksRunar;
    window.RagnaroksRunarUIManager = UIManager;

    game.settings.register(RagnaroksRunar.ID, "privateChats", {
        scope: "world", config: false, type: Object, default: {}
    });
    game.settings.register(RagnaroksRunar.ID, "groupChats", {
        scope: "world", config: false, type: Object, default: {}
    });
    
    game.settings.register(RagnaroksRunar.ID, "gmOverrideEnabled", {
        name: "Enable GM Override Sound",
        hint: "When enabled, all players will hear the 'Global Notification Sound' instead of their personal one.",
        scope: "world", config: true, type: Boolean, default: false
    });
    game.settings.register(RagnaroksRunar.ID, "gmOverrideSoundPath", {
        name: "Global Notification Sound",
        scope: "world", config: true, type: String, filePicker: "audio", default: "modules/ragnaroks-runar/sounds/notify.wav"
    });
    game.settings.register(RagnaroksRunar.ID, "enableSound", {
        name: "Enable My Notification Sound",
        hint: "Allows you to hear notification sounds from this module. You can disable this if you prefer no sounds.",
        scope: "client", config: true, type: Boolean, default: true
    });
    
    // UPDATED: Removed the static 'choices' array.
    game.settings.register(RagnaroksRunar.ID, "notificationSound", {
        name: "My Notification Sound",
        hint: "Choose your personal sound for new message notifications.",
        scope: "client",
        config: true,
        type: String,
        default: "modules/ragnaroks-runar/sounds/notify.wav"
    });
    
    game.settings.register(RagnaroksRunar.ID, "notificationVolume", {
        name: "My Notification Volume",
        scope: "client", config: true, type: Number, range: { min: 0, max: 1, step: 0.1 }, default: 0.8
    });
});

Hooks.once('ready', () => {
    RagnaroksRunar.initialize();
});

Hooks.on("renderPlayerList", (playerList, html) => {
    // This hook's content remains the same
    const playerListElement = html[0].querySelector('#player-list');
    if (!playerListElement) return;

    let controls = html[0].querySelector('#runar-controls');
    if (!controls) {
        controls = document.createElement('div');
        controls.id = 'runar-controls';
        Object.assign(controls.style, { display: 'flex', justifyContent: 'flex-end', gap: '5px', marginBottom: '5px' });
        playerListElement.before(controls);
    }

    if (game.user.isGM) {
        if (!controls.querySelector('.runar-group-manager-btn')) {
            const groupButton = document.createElement('button');
            groupButton.innerHTML = '<i class="fas fa-users-cog"></i>';
            groupButton.title = "Manage All Chats";
            groupButton.addEventListener("click", () => UIManager.openGroupManager());
            controls.append(groupButton);
        }
        if (!controls.querySelector('.gm-monitor-btn')) {
            const monitorButton = document.createElement('button');
            monitorButton.innerHTML = '<i class="fas fa-shield-alt"></i>';
            monitorButton.title = "GM Monitor";
            monitorButton.addEventListener("click", () => UIManager.openGMMonitor());
            controls.append(monitorButton);
        }
    } else {
        if (!controls.querySelector('.runar-player-hub-btn')) {
            const hubButton = document.createElement('button');
            hubButton.innerHTML = '<i class="fas fa-comments"></i>';
            hubButton.title = "My Chats";
            hubButton.addEventListener("click", () => UIManager.openPlayerHub());
            controls.append(hubButton);
        }
    }

    if (!controls.querySelector('.runar-settings-btn')) {
        const settingsButton = document.createElement('button');
        settingsButton.innerHTML = '<i class="fas fa-cog"></i>';
        settingsButton.title = "Settings";
        settingsButton.addEventListener("click", () => UIManager.openSettingsWindow());
        controls.append(settingsButton);
    }
});