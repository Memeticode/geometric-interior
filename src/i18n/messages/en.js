/**
 * English (en) message catalog.
 * Flat dot-path keys organized by domain.
 */
export default {
    /* ── Navigation ── */
    'nav.gallery': 'Gallery',
    'nav.generate': 'Generate',
    'nav.image': 'Image',
    'nav.animation': 'Animation',
    'nav.imageEditor': 'Image Editor',
    'nav.animationEditor': 'Animation Editor',

    /* ── Header ── */
    'header.title': 'Geometric Interior: Self-Portraits of a Predictive Model',
    'header.artistStatement': 'Artist Statement',
    'header.developerStatement': 'Developer Statement',
    'header.governanceFramework': 'Governance Framework',

    /* ── Gallery sections ── */
    'gallery.portraits': 'Portraits',
    'gallery.saved': 'Saved',
    'gallery.savedLocal': 'Saved (local)',
    'gallery.imageGallery': 'Image Gallery',
    'gallery.edit': 'Edit',

    /* ── Active card ── */
    'active.title': 'Active',
    'active.unsaved': 'Unsaved',
    'active.untitled': 'Untitled',
    'active.portrait': 'Portrait',
    'active.portraitUnsaved': 'Portrait \u00b7 unsaved',
    'active.user': 'User',
    'active.userUnsaved': 'User \u00b7 unsaved',

    /* ── Controls ── */
    'control.name': 'Name',
    'control.name.tooltip': 'A name for this arrangement of light and form.',
    'control.name.placeholder': 'e.g. Violet Crystalline',
    'control.intentSeed': 'Intent (seed)',
    'control.intentSeed.tooltip': 'A word that conjures this exact arrangement. Same whisper, same world. (Deterministic seed phrase.)',
    'control.intentSeed.placeholder': 'e.g. light arriving through crystal',
    'control.palette': 'Palette',
    'control.palette.tooltip': 'The chromatic atmosphere. Double-click a preset to customize.',
    'control.density': 'Density',
    'control.density.tooltip': 'How thickly forms crowd the void.',
    'control.luminosity': 'Luminosity',
    'control.luminosity.tooltip': 'The inner radiance of the scene.',
    'control.fracture': 'Fracture',
    'control.fracture.tooltip': 'How forms break and splinter through space.',
    'control.depth': 'Depth',
    'control.depth.tooltip': 'How the eye travels into the scene.',
    'control.coherence': 'Coherence',
    'control.coherence.tooltip': 'The discipline binding form to structure.',
    'control.topology': 'Topology',
    'control.topology.tooltip': 'The spatial architecture \u2014 how planes are arranged through the void.',

    /* ── Palette names ── */
    'palette.violet': 'Violet',
    'palette.warm': 'Warm',
    'palette.teal': 'Teal',
    'palette.prismatic': 'Prismatic',
    'palette.crystal': 'Crystal',
    'palette.sapphire': 'Sapphire',
    'palette.amethyst': 'Amethyst',
    'palette.custom': 'Custom',

    /* ── Custom palette editor ── */
    'palette.hue': 'Hue',
    'palette.hue.tooltip': 'Where on the spectrum the light begins.',
    'palette.range': 'Range',
    'palette.range.tooltip': 'How far color is allowed to wander from its origin.',
    'palette.saturation': 'Saturation',
    'palette.saturation.tooltip': 'The purity of pigment \u2014 dusty whisper to liquid jewel.',

    /* ── Topology labels ── */
    'topology.flow': 'Flow',
    'topology.crystal': 'Crystal',
    'topology.mobius': 'M\u00f6bius',
    'topology.attractor': 'Attractor',

    /* ── Config IO ── */
    'config.export': 'Export',
    'config.import': 'Import',
    'config.export.tooltip': 'Export configuration (json)',
    'config.import.tooltip': 'Import configuration (json)',

    /* ── Stage header buttons ── */
    'stage.prevHistory': 'Previous image (view history)',
    'stage.nextHistory': 'Next image (view history)',
    'stage.randomize': 'Randomize image',
    'stage.settings': 'Settings',
    'stage.share': 'Share this image',

    /* ── Share options ── */
    'share.copyLink': 'Copy Link',
    'share.downloadVisual': 'Download Visual',
    'share.shareOnX': 'Share on X',
    'share.facebook': 'Facebook',
    'share.bluesky': 'Bluesky',
    'share.reddit': 'Reddit',
    'share.linkedin': 'LinkedIn',
    'share.email': 'Email',

    /* ── Animation settings ── */
    'settings.enableAnimation': 'Enable animation',
    'settings.sparkle': 'Sparkle',
    'settings.drift': 'Drift',
    'settings.wobble': 'Wobble',
    'settings.length': 'Length',
    'settings.fps': 'FPS',

    /* ── Toast messages ── */
    'toast.enterName': 'Enter a name first.',
    'toast.alreadyPortrait': 'Already saved as a portrait.',
    'toast.renderFirst': 'Render first.',
    'toast.configExported': 'Configuration exported.',
    'toast.exportFailed': 'Export failed.',
    'toast.linkCopied': 'Link copied to clipboard.',
    'toast.linkCopiedShort': 'Link copied.',
    'toast.jszipMissing': 'JSZip missing (offline?).',
    'toast.visualExported': 'Visual exported.',
    'toast.visualExportFailed': 'Visual export failed.',
    'toast.imported': 'Imported {count} profile{s}.',

    /* ── Confirm dialogs ── */
    'confirm.overwriteProfile': 'Overwrite Profile',
    'confirm.overwriteUser': 'User profile \u201c{name}\u201d already exists. The existing image will be overwritten.',
    'confirm.overwriteGeneric': 'Profile \u201c{name}\u201d already exists. The existing image will be overwritten.',
    'confirm.resetChanges': 'Reset Changes',
    'confirm.discardChanges': 'Discard all changes to \u201c{name}\u201d? Unsaved changes will be lost.',
    'confirm.unsavedChanges': 'Unsaved Changes',
    'confirm.saveBeforeSwitch': 'Save \u201c{name}\u201d before switching?',
    'confirm.saveAsNew': 'Save \u201c{name}\u201d as a new profile?',
    'confirm.discardAndRandomize': 'Discard unsaved changes and randomize?',
    'confirm.deleteProfile': 'Delete Profile',
    'confirm.deleteConfirm': 'Delete \u201c{name}\u201d?',

    /* ── Button labels (confirm dialogs) ── */
    'btn.cancel': 'Cancel',
    'btn.overwrite': 'Overwrite',
    'btn.reset': 'Reset',
    'btn.discard': 'Discard',
    'btn.save': 'Save',
    'btn.delete': 'Delete',
    'btn.import': 'Import',

    /* ── Import modal ── */
    'import.title': 'Import Profile',
    'import.uploadJson': 'Upload JSON file',
    'import.pasteJson': 'Paste JSON',
    'import.chooseFile': 'Choose file or drag here',
    'import.or': 'or',

    /* ── Panel toggle ── */
    'panel.openMenu': 'Open menu',
    'panel.closeMenu': 'Close menu',
    'panel.controlsPanel': 'Controls panel',

    /* ── Active card config toggle ── */
    'activeCard.openConfig': 'Open Configuration',
    'activeCard.closeConfig': 'Close Configuration',

    /* ── Profiles ── */
    'profile.save.tooltip': 'Save as user profile (local storage)',
    'profile.reset.tooltip': 'Reset changes',
    'profile.resetPalette.tooltip': 'Reset color palette',
    'profile.writeToCustom': 'Write to Custom',
    'profile.writeToCustom.tooltip': 'Apply the current palette configuration to custom palette',
    'profile.selectSaved': '\u2014 Select a saved profile \u2014',
    'profile.noProfilesYet': '\u2014 No profiles yet \u2014',
    'profile.addToLoop': 'Add 2+ profiles to build a loop.',
    'profile.missingProfile': 'missing profile',
    'profile.details': 'Details',

    /* ── Statement modal tab labels ── */
    'statement.artist': 'Artist Statement',
    'statement.developer': 'Developer Statement',
    'statement.governance': 'Governance Framework',

    /* ── Theme switcher ── */
    'theme.system': 'System',
    'theme.light': 'Light',
    'theme.dark': 'Dark',

    /* ── Language selector ── */
    'lang.en': 'EN',
    'lang.es': 'ES',

    /* ── Footer ── */
    'footer.github': 'GitHub',

    /* ── Page titles ── */
    'page.gallery': 'Gallery \u2014 Geometric Interior',
    'page.image': 'Image Editor \u2014 Geometric Interior',
    'page.animation': 'Animation Editor \u2014 Geometric Interior',

    /* ── Gallery arrows ── */
    'gallery.prevPortrait': 'Previous portrait',
    'gallery.nextPortrait': 'Next portrait',

    /* ── Close button aria ── */
    'aria.close': 'Close',

    /* ── Gallery page ── */
    'gallery.noSavedProfiles': 'No saved profiles yet.',
    'gallery.animComingSoon': 'Animation gallery coming soon.',
    'gallery.moveUp': 'Move up',
    'gallery.moveDown': 'Move down',
    'gallery.deleteProfile': 'Delete',
};
