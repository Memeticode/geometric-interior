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
    'header.parameters': 'Parameters',

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
    'control.density.tooltip': 'Abundance \u2014 how populated the space is. Controls the total number of geometric elements across all tiers. At 0, roughly 100 elements \u2014 a sparse, intimate composition where individual forms are distinct. At 1, over 1,000 elements fill the space.',
    'control.luminosity': 'Luminosity',
    'control.luminosity.tooltip': 'Energy \u2014 the overall brightness and glow intensity. Controls per-element glow strength, lighting factors, and bloom post-processing. At 0, scenes are dim but clearly visible \u2014 preserving color saturation and structural legibility. At 1, scenes are bright but not blown white.',
    'control.fracture': 'Fracture',
    'control.fracture.tooltip': 'Fragmentation \u2014 how shattered or whole the geometry is. Controls the degree of geometric scatter across all subsystems simultaneously: envelope radii, guide curve curvature, chain spread, dot scatter radius, and chromatic aberration.',
    'control.depth': 'Depth',
    'control.depth.tooltip': 'How the eye travels into the scene.',
    'control.coherence': 'Coherence',
    'control.coherence.tooltip': 'Organization \u2014 how strongly elements follow the flow pattern. Controls the flow field\u2019s influence on chain orientation and the noise scale of the flow field. At low coherence, chains orient randomly. At high coherence, chains align strongly to the flow field, creating visible directional structure.',
    'control.hue': 'Hue',
    'control.hue.tooltip': 'Color identity \u2014 the dominant wavelength of the emitted light. Maps linearly to the hue circle (hue \u00d7 360\u00b0). Determines the overall color character of the scene and tints the fog and background.',
    'control.spectrum': 'Spectrum',
    'control.spectrum.tooltip': 'Color range \u2014 the width of hue variation from monochrome to prismatic. Controls how much individual element colors vary around the dominant hue. Most of the slider travel covers the useful 10\u2013100\u00b0 range, with only the extreme top reaching full-spectrum prismatic.',
    'control.chroma': 'Chroma',
    'control.chroma.tooltip': 'Color intensity \u2014 how vivid the colors are. Controls saturation from nearly achromatic to fully vivid. Also affects fog tinting: at low chroma, the fog is neutral; at high chroma, the fog takes on the dominant hue \u2014 changing the space itself.',
    'control.scale': 'Scale',
    'control.scale.tooltip': 'Granularity \u2014 the size distribution of geometric elements. Controls the balance between tiers without changing the total element count. At low values, primary chains and hero dots dominate \u2014 a few bold geometric forms. At high values, tertiary chains and micro particles dominate \u2014 a cloud of fine particles.',
    'control.division': 'Division',
    'control.division.tooltip': 'Topology \u2014 the form\u2019s large-scale shape. Controls the envelope\u2019s symmetry breaking through groove depth and count. At low values, a single unified mass. At the midpoint, two lobes (the characteristic dual-core structure). At high values, three lobes in a triangular arrangement.',
    'control.faceting': 'Faceting',
    'control.faceting.tooltip': 'Crystal character \u2014 the quality of individual geometric faces. Controls the ratio of broad quads to sharp triangles, the dihedral fold angle between successive faces, and the contraction rate. Determines whether shards read as smooth panels or angular crystals.',
    'control.flow': 'Flow',
    'control.flow.tooltip': 'Spatial pattern \u2014 the shape of the directional field. At 0, radial starburst emanating from the center. At 0.5, chaotic Perlin noise (organic, no preferred direction). At 1, orbital bands wrapping around the form. Flow defines the shape of organization; coherence defines its strength.',
    'control.topology': 'Topology',
    'control.topology.tooltip': 'The spatial architecture \u2014 how planes are arranged through the void.',

    /* ── Generate panel headings ── */
    'generate.seed': 'Seed',
    'generate.seed.tooltip': 'A three-word compositional seed. Each word controls an independent random stream and visual bias \u2014 arrangement governs spatial flow, structure governs geometric character, and detail governs light and color energy. Same three words always produce the same composition.',
    'generate.parameters': 'Parameters',
    'generate.parameters.tooltip': 'Eleven continuous parameters, each a 0\u20131 scaling axis. Together they define an 11-dimensional creative space where every point produces a unique composition of luminous geometric forms.',

    /* ── Parameter sections ── */
    'params.heading': 'Parameters',
    'section.geometry': 'Geometry',
    'section.geometry.tooltip': 'The physical character of forms \u2014 their abundance, fragmentation, granularity, topology, and crystal quality.',
    'section.light': 'Light',
    'section.light.tooltip': 'The energy and radiance of the scene.',
    'section.color': 'Color',
    'section.color.tooltip': 'The chromatic identity of the emitted light \u2014 hue, spectral range, and intensity.',
    'section.space': 'Space',
    'section.space.tooltip': 'The directional organization of forms \u2014 flow patterns and structural coherence.',
    'section.camera': 'Camera',
    'section.camera.tooltip': 'Static framing of the scene \u2014 zoom level and orbital rotation angle.',

    /* ── Seed tag ── */
    'control.seed': 'Seed',
    'control.seed.tooltip': 'A three-word compositional seed. Each word controls an independent random stream and visual bias \u2014 arrangement governs spatial flow, structure governs geometric character, and detail governs light and color energy. Same three words always produce the same composition.',

    /* ── Camera controls ── */
    'control.zoom': 'Zoom',
    'control.zoom.tooltip': 'How close or far the viewpoint is. Below 1.0 moves closer to the forms, above 1.0 moves further away.',
    'control.rotation': 'Rotation',
    'control.rotation.tooltip': 'Orbital rotation angle around the scene center, in degrees. 360\u00b0 wraps back to 0\u00b0.',

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
    'statement.parameters': 'Parameters',

    /* ── Theme switcher ── */
    'theme.system': 'System',
    'theme.light': 'Light',
    'theme.dark': 'Dark',

    /* ── Language selector ── */
    'lang.en': 'EN',
    'lang.es': 'ES',

    /* ── Footer ── */
    'footer.github': 'GitHub',
    'footer.langLabel': 'Language',
    'footer.settings': 'Settings',
    'footer.theme': 'Theme',
    'footer.language': 'Language',
    'footer.resolution': 'Resolution',
    'footer.resolutionLabel': 'Render resolution',

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

    /* ── Site menu navigation ── */
    'menu.gallery': 'Gallery',
    'menu.generate': 'Generate',
    'menu.images': 'Images',
    'menu.animations': 'Animations',
    'menu.generateImages': 'Images',
    'menu.generateAnimations': 'Animations',

    /* ── Render queue menu ── */
    'renderQueue.title': 'Render Jobs',
    'renderQueue.clear': 'Clear',
    'renderQueue.empty': 'No render jobs',
    'renderQueue.cancel': 'Cancel',
    'renderQueue.view': 'View',
    'renderQueue.active': 'Active',
    'renderQueue.queued': 'Queued',
    'renderQueue.queuedSection': 'Queued',
    'renderQueue.completedSection': 'Completed',
    'renderQueue.complete': 'Complete',
    'renderQueue.failed': 'Failed',
    'renderQueue.noActive': 'No job active.',
    'renderQueue.noQueued': 'No jobs queued.',
    'renderQueue.noCompleted': 'No completed jobs.',
};
