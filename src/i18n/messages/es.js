/**
 * Spanish (es) message catalog.
 * Flat dot-path keys organized by domain.
 */
export default {
    /* ── Navigation ── */
    'nav.gallery': 'Galer\u00eda',
    'nav.generate': 'Generar',
    'nav.image': 'Imagen',
    'nav.animation': 'Animaci\u00f3n',
    'nav.imageEditor': 'Editor de Imagen',
    'nav.animationEditor': 'Editor de Animaci\u00f3n',

    /* ── Header ── */
    'header.title': 'Interior Geom\u00e9trico: Autorretratos de un Modelo Predictivo',
    'header.artistStatement': 'Manifiesto Art\u00edstico',
    'header.developerStatement': 'Manifiesto del Desarrollador',
    'header.governanceFramework': 'Marco de Gobernanza',

    /* ── Gallery sections ── */
    'gallery.portraits': 'Retratos',
    'gallery.saved': 'Guardados',
    'gallery.savedLocal': 'Guardados (local)',
    'gallery.imageGallery': 'Galer\u00eda de Im\u00e1genes',
    'gallery.edit': 'Editar',

    /* ── Active card ── */
    'active.title': 'Activo',
    'active.unsaved': 'Sin guardar',
    'active.untitled': 'Sin t\u00edtulo',
    'active.portrait': 'Retrato',
    'active.portraitUnsaved': 'Retrato \u00b7 sin guardar',
    'active.user': 'Usuario',
    'active.userUnsaved': 'Usuario \u00b7 sin guardar',

    /* ── Controls ── */
    'control.name': 'Nombre',
    'control.name.tooltip': 'Un nombre para esta composici\u00f3n de luz y forma.',
    'control.name.placeholder': 'ej. Cristalino Violeta',
    'control.intentSeed': 'Intenci\u00f3n (semilla)',
    'control.intentSeed.tooltip': 'Una palabra que invoca esta configuraci\u00f3n exacta. El mismo susurro, el mismo mundo. (Frase semilla determinista.)',
    'control.intentSeed.placeholder': 'ej. luz llegando a trav\u00e9s del cristal',
    'control.palette': 'Paleta',
    'control.palette.tooltip': 'La atm\u00f3sfera crom\u00e1tica. Doble clic en un preset para personalizar.',
    'control.density': 'Densidad',
    'control.density.tooltip': 'Cu\u00e1n densamente las formas llenan el vac\u00edo.',
    'control.luminosity': 'Luminosidad',
    'control.luminosity.tooltip': 'La radiancia interior de la escena.',
    'control.fracture': 'Fractura',
    'control.fracture.tooltip': 'C\u00f3mo las formas se quiebran y astillan en el espacio.',
    'control.depth': 'Profundidad',
    'control.depth.tooltip': 'C\u00f3mo la mirada se adentra en la escena.',
    'control.coherence': 'Coherencia',
    'control.coherence.tooltip': 'La disciplina que une forma y estructura.',
    'control.topology': 'Topolog\u00eda',
    'control.topology.tooltip': 'La arquitectura espacial \u2014 c\u00f3mo los planos se distribuyen en el vac\u00edo.',

    /* ── Palette names ── */
    'palette.violet': 'Violeta',
    'palette.warm': 'C\u00e1lido',
    'palette.teal': 'Turquesa',
    'palette.prismatic': 'Prism\u00e1tico',
    'palette.crystal': 'Cristal',
    'palette.sapphire': 'Zafiro',
    'palette.amethyst': 'Amatista',
    'palette.custom': 'Personalizado',

    /* ── Custom palette editor ── */
    'palette.hue': 'Tono',
    'palette.hue.tooltip': 'Donde en el espectro comienza la luz.',
    'palette.range': 'Rango',
    'palette.range.tooltip': 'Hasta d\u00f3nde el color puede vagar desde su origen.',
    'palette.saturation': 'Saturaci\u00f3n',
    'palette.saturation.tooltip': 'La pureza del pigmento \u2014 susurro polvoriento a joya l\u00edquida.',

    /* ── Topology labels ── */
    'topology.flow': 'Flujo',
    'topology.crystal': 'Cristal',
    'topology.mobius': 'M\u00f6bius',
    'topology.attractor': 'Atractor',

    /* ── Config IO ── */
    'config.export': 'Exportar',
    'config.import': 'Importar',
    'config.export.tooltip': 'Exportar configuraci\u00f3n (json)',
    'config.import.tooltip': 'Importar configuraci\u00f3n (json)',

    /* ── Stage header buttons ── */
    'stage.prevHistory': 'Imagen anterior (historial)',
    'stage.nextHistory': 'Imagen siguiente (historial)',
    'stage.randomize': 'Aleatorizar imagen',
    'stage.settings': 'Ajustes',
    'stage.share': 'Compartir esta imagen',

    /* ── Share options ── */
    'share.copyLink': 'Copiar enlace',
    'share.downloadVisual': 'Descargar imagen',
    'share.shareOnX': 'Compartir en X',
    'share.facebook': 'Facebook',
    'share.bluesky': 'Bluesky',
    'share.reddit': 'Reddit',
    'share.linkedin': 'LinkedIn',
    'share.email': 'Correo',

    /* ── Animation settings ── */
    'settings.enableAnimation': 'Activar animaci\u00f3n',
    'settings.sparkle': 'Destello',
    'settings.drift': 'Deriva',
    'settings.wobble': 'Oscilaci\u00f3n',
    'settings.length': 'Duraci\u00f3n',
    'settings.fps': 'FPS',

    /* ── Toast messages ── */
    'toast.enterName': 'Introduce un nombre primero.',
    'toast.alreadyPortrait': 'Ya guardado como retrato.',
    'toast.renderFirst': 'Renderiza primero.',
    'toast.configExported': 'Configuraci\u00f3n exportada.',
    'toast.exportFailed': 'Error en la exportaci\u00f3n.',
    'toast.linkCopied': 'Enlace copiado al portapapeles.',
    'toast.linkCopiedShort': 'Enlace copiado.',
    'toast.jszipMissing': 'JSZip no disponible (\u00bfsin conexi\u00f3n?).',
    'toast.visualExported': 'Imagen exportada.',
    'toast.visualExportFailed': 'Error al exportar la imagen.',
    'toast.imported': '{count} perfil{s} importado{s}.',

    /* ── Confirm dialogs ── */
    'confirm.overwriteProfile': 'Sobrescribir perfil',
    'confirm.overwriteUser': 'El perfil de usuario \u201c{name}\u201d ya existe. La imagen existente ser\u00e1 reemplazada.',
    'confirm.overwriteGeneric': 'El perfil \u201c{name}\u201d ya existe. La imagen existente ser\u00e1 reemplazada.',
    'confirm.resetChanges': 'Restablecer cambios',
    'confirm.discardChanges': '\u00bfDescartar todos los cambios en \u201c{name}\u201d? Los cambios no guardados se perder\u00e1n.',
    'confirm.unsavedChanges': 'Cambios sin guardar',
    'confirm.saveBeforeSwitch': '\u00bfGuardar \u201c{name}\u201d antes de cambiar?',
    'confirm.saveAsNew': '\u00bfGuardar \u201c{name}\u201d como nuevo perfil?',
    'confirm.discardAndRandomize': '\u00bfDescartar cambios no guardados y aleatorizar?',
    'confirm.deleteProfile': 'Eliminar perfil',
    'confirm.deleteConfirm': '\u00bfEliminar \u201c{name}\u201d?',

    /* ── Button labels (confirm dialogs) ── */
    'btn.cancel': 'Cancelar',
    'btn.overwrite': 'Sobrescribir',
    'btn.reset': 'Restablecer',
    'btn.discard': 'Descartar',
    'btn.save': 'Guardar',
    'btn.delete': 'Eliminar',
    'btn.import': 'Importar',

    /* ── Import modal ── */
    'import.title': 'Importar perfil',
    'import.uploadJson': 'Subir archivo JSON',
    'import.pasteJson': 'Pegar JSON',
    'import.chooseFile': 'Elegir archivo o arrastrar aqu\u00ed',
    'import.or': 'o',

    /* ── Panel toggle ── */
    'panel.openMenu': 'Abrir men\u00fa',
    'panel.closeMenu': 'Cerrar men\u00fa',
    'panel.controlsPanel': 'Panel de controles',

    /* ── Active card config toggle ── */
    'activeCard.openConfig': 'Abrir configuraci\u00f3n',
    'activeCard.closeConfig': 'Cerrar configuraci\u00f3n',

    /* ── Profiles ── */
    'profile.save.tooltip': 'Guardar como perfil de usuario (almacenamiento local)',
    'profile.reset.tooltip': 'Restablecer cambios',
    'profile.resetPalette.tooltip': 'Restablecer paleta de colores',
    'profile.writeToCustom': 'Escribir en Personalizado',
    'profile.writeToCustom.tooltip': 'Aplicar la configuraci\u00f3n actual de paleta al preset personalizado',
    'profile.selectSaved': '\u2014 Seleccionar un perfil guardado \u2014',
    'profile.noProfilesYet': '\u2014 A\u00fan no hay perfiles \u2014',
    'profile.addToLoop': 'A\u00f1ade 2+ perfiles para construir un bucle.',
    'profile.missingProfile': 'perfil faltante',
    'profile.details': 'Detalles',

    /* ── Statement modal tab labels ── */
    'statement.artist': 'Manifiesto Art\u00edstico',
    'statement.developer': 'Manifiesto del Desarrollador',
    'statement.governance': 'Marco de Gobernanza',

    /* ── Theme switcher ── */
    'theme.system': 'Sistema',
    'theme.light': 'Claro',
    'theme.dark': 'Oscuro',

    /* ── Language selector ── */
    'lang.en': 'EN',
    'lang.es': 'ES',

    /* ── Footer ── */
    'footer.github': 'GitHub',
    'footer.langLabel': 'Idioma',
    'footer.settings': 'Ajustes',
    'footer.theme': 'Tema',
    'footer.language': 'Idioma',
    'footer.resolution': 'Resoluci\u00f3n',
    'footer.resolutionLabel': 'Resoluci\u00f3n de renderizado',

    /* ── Page titles ── */
    'page.gallery': 'Galer\u00eda \u2014 Interior Geom\u00e9trico',
    'page.image': 'Editor de Imagen \u2014 Interior Geom\u00e9trico',
    'page.animation': 'Editor de Animaci\u00f3n \u2014 Interior Geom\u00e9trico',

    /* ── Gallery arrows ── */
    'gallery.prevPortrait': 'Retrato anterior',
    'gallery.nextPortrait': 'Retrato siguiente',

    /* ── Close button aria ── */
    'aria.close': 'Cerrar',

    /* ── Gallery page ── */
    'gallery.noSavedProfiles': 'A\u00fan no hay perfiles guardados.',
    'gallery.animComingSoon': 'Galer\u00eda de animaciones pr\u00f3ximamente.',
    'gallery.moveUp': 'Subir',
    'gallery.moveDown': 'Bajar',
    'gallery.deleteProfile': 'Eliminar',
};
