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
    'header.parameters': 'Par\u00e1metros',

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
    'control.density.tooltip': 'Abundancia \u2014 cu\u00e1n poblado est\u00e1 el espacio. Controla el n\u00famero total de elementos geom\u00e9tricos en todos los niveles. En 0, aproximadamente 100 elementos \u2014 una composici\u00f3n dispersa e \u00edntima donde las formas individuales son distinguibles. En 1, m\u00e1s de 1.000 elementos llenan el espacio.',
    'control.luminosity': 'Luminosidad',
    'control.luminosity.tooltip': 'Energ\u00eda \u2014 el brillo general y la intensidad del resplandor. Controla la fuerza de brillo por elemento, factores de iluminaci\u00f3n y posprocesamiento de bloom. En 0, las escenas son tenues pero claramente visibles \u2014 preservando la saturaci\u00f3n de color y la legibilidad estructural. En 1, brillantes pero sin quemarse a blanco.',
    'control.fracture': 'Fractura',
    'control.fracture.tooltip': 'Fragmentaci\u00f3n \u2014 cu\u00e1n fragmentada o \u00edntegra es la geometr\u00eda. Controla el grado de dispersi\u00f3n geom\u00e9trica en todos los subsistemas simult\u00e1neamente: radios de envolvente, curvatura de gu\u00edas, dispersi\u00f3n de cadenas, radio de dispersi\u00f3n de puntos y aberraci\u00f3n crom\u00e1tica.',
    'control.depth': 'Profundidad',
    'control.depth.tooltip': 'C\u00f3mo la mirada se adentra en la escena.',
    'control.coherence': 'Coherencia',
    'control.coherence.tooltip': 'Organizaci\u00f3n \u2014 cu\u00e1n fuertemente los elementos siguen el patr\u00f3n de flujo. Controla la influencia del campo de flujo en la orientaci\u00f3n de las cadenas y la escala de ruido del campo. Con baja coherencia, las cadenas se orientan aleatoriamente. Con alta coherencia, se alinean fuertemente al campo de flujo, creando estructura direccional visible.',
    'control.hue': 'Tono',
    'control.hue.tooltip': 'Identidad crom\u00e1tica \u2014 la longitud de onda dominante de la luz emitida. Se mapea linealmente al c\u00edrculo de tonos (tono \u00d7 360\u00b0). Determina el car\u00e1cter crom\u00e1tico general de la escena y ti\u00f1e la niebla y el fondo.',
    'control.spectrum': 'Espectro',
    'control.spectrum.tooltip': 'Rango crom\u00e1tico \u2014 la amplitud de variaci\u00f3n de tono, de monocrom\u00e1tico a prism\u00e1tico. Controla cu\u00e1nto var\u00edan los colores de los elementos individuales alrededor del tono dominante. La mayor parte del recorrido del control cubre el rango \u00fatil de 10\u2013100\u00b0, con solo el extremo superior alcanzando el espectro completo.',
    'control.chroma': 'Croma',
    'control.chroma.tooltip': 'Intensidad crom\u00e1tica \u2014 cu\u00e1n vivos son los colores. Controla la saturaci\u00f3n desde casi acrom\u00e1tico hasta completamente v\u00edvido. Tambi\u00e9n afecta el tinte de la niebla: con bajo croma, la niebla es neutra; con alto croma, la niebla adopta el tono dominante \u2014 cambiando el espacio mismo.',
    'control.scale': 'Escala',
    'control.scale.tooltip': 'Granularidad \u2014 la distribuci\u00f3n de tama\u00f1os de los elementos geom\u00e9tricos. Controla el equilibrio entre niveles sin cambiar el n\u00famero total de elementos. En valores bajos, las cadenas primarias y puntos principales dominan \u2014 pocas formas geom\u00e9tricas audaces. En valores altos, las cadenas terciarias y micropart\u00edculas dominan \u2014 una nube de part\u00edculas finas.',
    'control.division': 'Divisi\u00f3n',
    'control.division.tooltip': 'Topolog\u00eda \u2014 la forma a gran escala. Controla la ruptura de simetr\u00eda de la envolvente mediante la profundidad y cantidad de surcos. En valores bajos, una masa unificada. En el punto medio, dos l\u00f3bulos (la estructura caracter\u00edstica de doble n\u00facleo). En valores altos, tres l\u00f3bulos en disposici\u00f3n triangular.',
    'control.faceting': 'Facetado',
    'control.faceting.tooltip': 'Car\u00e1cter cristalino \u2014 la calidad de las caras geom\u00e9tricas individuales. Controla la proporci\u00f3n de quads amplios a tri\u00e1ngulos agudos, el \u00e1ngulo diedro de plegado entre caras sucesivas y la tasa de contracci\u00f3n. Determina si los fragmentos se leen como paneles suaves o cristales angulares.',
    'control.flow': 'Flujo',
    'control.flow.tooltip': 'Patr\u00f3n espacial \u2014 la forma del campo direccional. En 0, estallido radial emanando del centro. En 0.5, ruido Perlin ca\u00f3tico (org\u00e1nico, sin direcci\u00f3n preferente). En 1, bandas orbitales envolviendo la forma. El flujo define la forma de la organizaci\u00f3n; la coherencia define su intensidad.',
    'control.topology': 'Topolog\u00eda',
    'control.topology.tooltip': 'La arquitectura espacial \u2014 c\u00f3mo los planos se distribuyen en el vac\u00edo.',

    /* ── Generate panel headings ── */
    'generate.seed': 'Semilla',
    'generate.seed.tooltip': 'Una semilla compositiva de tres palabras. Cada palabra controla un flujo aleatorio independiente y un sesgo visual \u2014 disposici\u00f3n gobierna el flujo espacial, estructura gobierna el car\u00e1cter geom\u00e9trico, y detalle gobierna la luz y energ\u00eda crom\u00e1tica. Las mismas tres palabras siempre producen la misma composici\u00f3n.',
    'generate.parameters': 'Par\u00e1metros',
    'generate.parameters.tooltip': 'Once par\u00e1metros continuos, cada uno un eje de escala de 0 a 1. Juntos definen un espacio creativo de 11 dimensiones donde cada punto produce una composici\u00f3n \u00fanica de formas geom\u00e9tricas luminosas.',

    /* ── Parameter sections ── */
    'params.heading': 'Par\u00e1metros',
    'section.geometry': 'Geometr\u00eda',
    'section.geometry.tooltip': 'El car\u00e1cter f\u00edsico de las formas \u2014 su abundancia, fragmentaci\u00f3n, granularidad, topolog\u00eda y calidad cristalina.',
    'section.light': 'Luz',
    'section.light.tooltip': 'La energ\u00eda y radiancia de la escena.',
    'section.color': 'Color',
    'section.color.tooltip': 'La identidad crom\u00e1tica de la luz emitida \u2014 tono, rango espectral e intensidad.',
    'section.space': 'Espacio',
    'section.space.tooltip': 'La organizaci\u00f3n direccional de las formas \u2014 patrones de flujo y coherencia estructural.',
    'section.camera': 'C\u00e1mara',
    'section.camera.tooltip': 'Encuadre est\u00e1tico de la escena \u2014 nivel de zoom y \u00e1ngulo de rotaci\u00f3n orbital.',

    /* ── Seed tag ── */
    'control.seed': 'Semilla',
    'control.seed.tooltip': 'Una semilla compositiva de tres palabras. Cada palabra controla un flujo aleatorio independiente y un sesgo visual \u2014 disposici\u00f3n gobierna el flujo espacial, estructura gobierna el car\u00e1cter geom\u00e9trico, y detalle gobierna la luz y energ\u00eda crom\u00e1tica.',

    /* ── Camera controls ── */
    'control.zoom': 'Zoom',
    'control.zoom.tooltip': 'Qu\u00e9 tan cerca o lejos est\u00e1 el punto de vista. Por debajo de 1.0 se acerca, por encima de 1.0 se aleja.',
    'control.rotation': 'Rotaci\u00f3n',
    'control.rotation.tooltip': '\u00c1ngulo de rotaci\u00f3n orbital alrededor del centro de la escena, en grados. 360\u00b0 vuelve a 0\u00b0.',

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
    'statement.parameters': 'Par\u00e1metros',

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

    /* ── Site menu navigation ── */
    'menu.gallery': 'Galer\u00eda',
    'menu.generate': 'Generar',
    'menu.images': 'Im\u00e1genes',
    'menu.animations': 'Animaciones',
    'menu.generateImages': 'Im\u00e1genes',
    'menu.generateAnimations': 'Animaciones',

    /* ── Animation editor ── */
    'nav.animationEditor': 'Editor de Animaci\u00f3n',
    'anim.scenes': 'Escenas',
    'anim.addEvent': '+ A\u00f1adir Evento',
    'anim.selectType': 'Seleccionar tipo de evento',
    'anim.expand': 'Expandir',
    'anim.pause': 'Pausa',
    'anim.transition': 'Transici\u00f3n',
    'anim.collapse': 'Colapsar',
    'anim.holdsCurrentScene': '(mantiene la escena actual)',
    'anim.selectProfile': 'Seleccionar Perfil',
    'anim.changeProfile': 'Cambiar Perfil',
    'anim.portraits': 'Retratos',
    'anim.saved': 'Guardados',
    'anim.fps': 'FPS',
    'anim.resolution': 'Resoluci\u00f3n',
    'anim.totalDuration': 'Duraci\u00f3n',
    'anim.totalFrames': 'Fotogramas',
    'anim.preview': '\u25B6 Vista previa',
    'anim.renderAnimation': 'Renderizar Animaci\u00f3n',
    'anim.addEventFirst': 'A\u00f1ade al menos un evento primero.',
    'anim.queued': 'Animaci\u00f3n en cola de renderizado.',
    'anim.renderComplete': 'Animaci\u00f3n renderizada.',
    'anim.renderFailed': 'Error al renderizar animaci\u00f3n.',

    /* ── Render queue menu ── */
    'renderQueue.title': 'Trabajos de renderizado',
    'renderQueue.clear': 'Limpiar',
    'renderQueue.empty': 'Sin trabajos',
    'renderQueue.cancel': 'Cancelar',
    'renderQueue.view': 'Ver',
    'renderQueue.active': 'Activo',
    'renderQueue.queued': 'En cola',
    'renderQueue.queuedSection': 'En cola',
    'renderQueue.completedSection': 'Completados',
    'renderQueue.complete': 'Completo',
    'renderQueue.failed': 'Error',
    'renderQueue.noActive': 'Ning\u00fan trabajo activo.',
    'renderQueue.noQueued': 'Sin trabajos en cola.',
    'renderQueue.noCompleted': 'Sin trabajos completados.',
};
