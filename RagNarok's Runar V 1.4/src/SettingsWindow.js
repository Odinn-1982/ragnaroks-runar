const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
import { RagnaroksRunar } from './RagnaroksRunar.js';

export class SettingsWindow extends HandlebarsApplicationMixin(ApplicationV2) {

    static DEFAULT_OPTIONS = {
        id: 'runar-settings-window',
        classes: ['ragnaroks-runar'],
        window: { title: "RNR.SettingsTitle", resizable: false, width: 400, height: "auto" },
        tag: 'form',
        form: {
            handler: SettingsWindow.#onFormSubmit,
            closeOnSubmit: true
        }
    };

    get title() {
        return game.i18n.localize(this.options.window.title);
    }

    static PARTS = {
        form: { template: `modules/ragnaroks-runar/templates/settings-window.hbs` }
    };

    async _prepareContext(options) {
        const sounds = [];
        const targetPath = `modules/${RagnaroksRunar.ID}/sounds/`;
        
        try {
            const browseResult = await FilePicker.browse("data", targetPath, {
                extensions: [".wav", ".mp3", ".ogg", ".flac"]
            });

            for (const filePath of browseResult.files) {
                const fileName = filePath.split('/').pop();
                let soundName = fileName.substring(0, fileName.lastIndexOf('.'));
                
                // V13 DEFINITIVE FIX: Use pure JavaScript string manipulation to guarantee compatibility.
                let cleanName = soundName.replace(/[-_]/g, ' ');
                cleanName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
                
                sounds.push({ path: filePath, name: cleanName }); 
            }
        } catch (error) {
            console.error(`${RagnaroksRunar.NAME} | Could not browse for sounds in ${targetPath}.`, error);
            ui.notifications.error("Could not load notification sounds list.");
        }

        const currentSound = game.settings.get(RagnaroksRunar.ID, "notificationSound");
        return { sounds, currentSound };
    }

    _onRender(context, options) {
        super._onRender(context, options);
        this.element.querySelector('[data-action="preview-sound"]')?.addEventListener('click', this._onPreviewSound.bind(this));
    }

    _onPreviewSound(event) {
        event.preventDefault();
        const select = this.element.querySelector('select[name="notificationSound"]');
        
        const selectedOption = select.options[select.selectedIndex];
        const soundPath = selectedOption ? selectedOption.getAttribute('value') : null;

        if (soundPath) {
            const volume = game.settings.get(RagnaroksRunar.ID, "notificationVolume");
            foundry.audio.AudioHelper.play({ src: soundPath, volume: volume, autoplay: true, loop: false }, false);
        } else {
            ui.notifications.error("Could not play sound preview. No sound selected.");
        }
    }
    
    static async #onFormSubmit(event, form, formData) {
        const newSound = formData.object.notificationSound;
        await game.settings.set(RagnaroksRunar.ID, "notificationSound", newSound);
        ui.notifications.info(game.i18n.localize("RNR.SoundUpdateSuccess"));
    }
}