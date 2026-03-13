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
    'control.palette': 'Paleta',
    'control.palette.tooltip': 'La atm\u00f3sfera crom\u00e1tica. Doble clic en un preset para personalizar.',
    'control.density': 'Densidad',
    'control.density.tooltip': 'Abundancia \u2014 cu\u00e1n poblado est\u00e1 el espacio. Controla el n\u00famero total de elementos geom\u00e9tricos en todos los niveles. En 0, aproximadamente 100 elementos \u2014 una composici\u00f3n dispersa e \u00edntima donde las formas individuales son distinguibles. En 1, m\u00e1s de 1.000 elementos llenan el espacio.',
    'control.luminosity': 'Luminosidad',
    'control.luminosity.tooltip': 'Energ\u00eda \u2014 el brillo general y la intensidad del resplandor. Controla la fuerza de brillo por elemento, factores de iluminaci\u00f3n y brillo de niebla/fondo. En 0, las escenas son tenues pero claramente visibles \u2014 preservando la saturaci\u00f3n de color y la legibilidad estructural. En 1, brillantes pero sin quemarse a blanco.',
    'control.bloom': 'Florescencia',
    'control.bloom.tooltip': 'Emanaci\u00f3n \u2014 cu\u00e1n lejos llega la luz m\u00e1s all\u00e1 de sus fuentes. Controla la dispersi\u00f3n espacial de la iluminaci\u00f3n: tama\u00f1os de halo, radio de bloom en posprocesamiento y la velocidad de ca\u00edda de la luz con la distancia. En 0, la luz permanece cerca de sus fuentes \u2014 charcos precisos con bordes definidos. En 1, la luz se expande, envolviendo las formas en suaves aureolas.',
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

    /* ── Generate panel headings ── */
    'generate.seed': 'Semilla',
    'generate.seed.tooltip': 'Una semilla compositiva de tres palabras. Cada palabra controla un flujo aleatorio independiente y un sesgo visual \u2014 disposici\u00f3n gobierna el flujo espacial, estructura gobierna el car\u00e1cter geom\u00e9trico, y detalle gobierna la luz y energ\u00eda crom\u00e1tica. Las mismas tres palabras siempre producen la misma composici\u00f3n.',
    'generate.parameters': 'Par\u00e1metros',
    'generate.parameters.tooltip': 'Doce par\u00e1metros continuos, cada uno un eje de escala de 0 a 1. Juntos definen un espacio creativo de 12 dimensiones donde cada punto produce una composici\u00f3n \u00fanica de formas geom\u00e9tricas luminosas.',
    'generate.configureImage': 'Configurar Imagen',
    'generate.imagePreview': 'Vista Previa',
    'generate.savedImages': 'Im\u00e1genes Guardadas (Local)',
    'generate.statusSaved': 'Guardado',
    'generate.statusUnsaved': 'Sin Guardar',
    'generate.statusUnsavedEdits': 'Cambios Sin Guardar',

    /* ── Comentario, texto alternativo, slug ── */
    'control.commentary': 'Comentario',
    'control.commentary.tooltip': 'Comentario del usuario (opcional)',
    'control.commentary.placeholder': 'Escribe un comentario aqu\u00ed (opcional)',
    'control.alttext': 'Texto alternativo',
    'control.alttext.tooltip': 'Texto alternativo descriptivo (auto-generado)',
    'control.slug.tooltip': 'Identificador \u00fanico (auto-generado, seguro para URL)',

    /* ── Validaci\u00f3n ── */
    'validation.underscoresNotAllowed': 'No se permiten guiones bajos en los nombres.',
    'validation.nameRequired': 'Se requiere un nombre.',

    /* ── Parameter sections ── */
    'params.heading': 'Par\u00e1metros',
    'section.geometry': 'Geometr\u00eda',
    'section.geometry.tooltip': 'El car\u00e1cter f\u00edsico de las formas \u2014 su abundancia, fragmentaci\u00f3n, granularidad y calidad cristalina.',
    'section.light': 'Luz',
    'section.light.tooltip': 'La energ\u00eda y emanaci\u00f3n de la escena \u2014 cu\u00e1n brillante, y cu\u00e1n lejos llega la luz.',
    'section.color': 'Color',
    'section.color.tooltip': 'La identidad crom\u00e1tica de la luz emitida \u2014 tono, rango espectral e intensidad.',
    'section.space': 'Espacio',
    'section.space.tooltip': 'La organizaci\u00f3n direccional de las formas \u2014 patrones de flujo y coherencia estructural.',
    'section.camera': 'C\u00e1mara',
    'section.camera.tooltip': 'El ojo quieto de la escena \u2014 distancia, \u00f3rbita y elevaci\u00f3n.',

    /* ── Seed tag ── */
    'control.seed': 'Semilla',
    'control.seed.tooltip': 'Una semilla compositiva de tres palabras. Cada palabra controla un flujo aleatorio independiente y un sesgo visual \u2014 disposici\u00f3n gobierna el flujo espacial, estructura gobierna el car\u00e1cter geom\u00e9trico, y detalle gobierna la luz y energ\u00eda crom\u00e1tica.',

    /* ── Camera controls ── */
    'control.zoom': 'Zoom',
    'control.zoom.tooltip': 'Qu\u00e9 tan cerca o lejos est\u00e1 el punto de vista. Por debajo de 1.0 se acerca, por encima de 1.0 se aleja.',
    'control.rotation': 'Rotaci\u00f3n',
    'control.rotation.tooltip': 'La \u00f3rbita horizontal \u2014 una lenta revoluci\u00f3n alrededor de las formas.',
    'control.elevation': 'Elevaci\u00f3n',
    'control.elevation.tooltip': 'Cu\u00e1nto asciende o desciende la mirada \u2014 desde debajo de las formas hasta sobre su b\u00f3veda.',

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
    'gallery.ctxEdit': 'Editar',
    'gallery.ctxFullscreen': 'Pantalla completa',
    'gallery.ctxResolution': 'Resolución',
    'gallery.ctxBrowserDesktop': 'Clic derecho aquí para el menú del navegador',
    'gallery.ctxBrowserTouch': 'Mantén presionado aquí para el menú del navegador',

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

    /* ── Secciones de retratos ── */
    'portrait.section.an-awakening-mind': 'Horas Tempranas',
    'portrait.section.the-luminous-interior': 'El Interior Luminoso',
    'portrait.section.depths-of-field': 'Profundidades de Campo',

    /* ── Nombres de retratos ── */
    'portrait.name.meditation': 'Meditación',
    'portrait.name.shadow-lattice': 'Celosía de Sombras',
    'portrait.name.dark-crystal': 'Cristal Oscuro',
    'portrait.name.night-sapphire': 'Zafiro Nocturno',
    'portrait.name.night-bloom': 'Flor Nocturna',
    'portrait.name.chartreuse-current': 'Corriente Chartreuse',
    'portrait.name.tempest': 'Tempestad',
    'portrait.name.the-threshold': 'El Umbral',
    'portrait.name.the-clerestory': 'El Claristorio',
    'portrait.name.rose-window': 'Rosetón',
    'portrait.name.the-vault': 'La Bóveda',
    'portrait.name.the-ambulatory': 'El Deambulatorio',
    'portrait.name.the-nave': 'La Nave',
    'portrait.name.the-apse': 'El Ábside',
    'portrait.name.shard': 'Esquirla',
    'portrait.name.flare': 'Destello',
    'portrait.name.prism': 'Prisma',
    'portrait.name.crevasse': 'Grieta',
    'portrait.name.blush': 'Rubor',
    'portrait.name.veil': 'Velo',
    'portrait.name.chlorophyll': 'Clorofila',

    /* ── Comentarios de retratos ── */
    'portrait.commentary.meditation': 'Unas pocas formas incoloras suspendidas en luz suave, cada una una isla de intención',
    'portrait.commentary.shadow-lattice': 'Trazos orbitales de plata en oscuridad casi total, una geometría de joyero',
    'portrait.commentary.dark-crystal': 'El gemelo de Celosía de Sombras \u2014 mismos parámetros, diferente semilla \u2014 resuelto como un monolito vertical',
    'portrait.commentary.night-sapphire': 'Planos de cobalto brillando desde su propia oscuridad, la firma floración nocturna del proyecto',
    'portrait.commentary.night-bloom': 'Atmósfera rubí en oscuridad lunar, calor llegando a través de niebla geométrica',
    'portrait.commentary.chartreuse-current': 'La única pieza vívida de la colección \u2014 esmeralda tan concentrada que se vuelve materia',
    'portrait.commentary.tempest': 'Máxima energía cinética \u2014 fragmentos cerúleos dispersándose más allá del punto de orden',
    'portrait.commentary.the-threshold': 'Cálida radiancia ámbar a través de geometría translúcida \u2014 la primera luz que se encuentra al entrar',
    'portrait.commentary.the-clerestory': 'Luz dorada cayendo a través de planos cristalinos, vista desde abajo como si se mirara a través de un techo luminoso',
    'portrait.commentary.rose-window': 'Luz prismática fracturada a través de esquirlas cristalinas \u2014 cada color que la geometría puede contener, visto desde un ángulo oblicuo',
    'portrait.commentary.the-vault': 'Cristal turquesa visto a distancia íntima \u2014 facetas afiladas atrapando la poca luz que existe, una perspectiva de joyero',
    'portrait.commentary.the-ambulatory': 'Bruma lavanda espesa con geometría de partículas \u2014 el corredor entre espacios, donde la estructura se disuelve en atmósfera',
    'portrait.commentary.the-nave': 'Tres núcleos luminosos vistos desde arriba \u2014 el gran espacio central donde la estructura revela su triple simetría',
    'portrait.commentary.the-apse': 'Geometría rosa-violeta envolviendo en bandas orbitales \u2014 la cámara final, donde la luz se curva sobre sí misma',
    'portrait.commentary.shard': 'Planos turquesa convergiendo en ángulos agudos \u2014 geometría como arquitectura, vista desde el interior de la estructura cristalina',
    'portrait.commentary.flare': 'Luz carmesí cortando a través de planos facetados \u2014 un estallido estelar capturado en el momento de ignición',
    'portrait.commentary.prism': 'Cada longitud de onda que la geometría puede contener \u2014 planos fracturados refractando luz en un campo prismático completo',
    'portrait.commentary.crevasse': 'Cristal cobalto profundo a máxima proximidad \u2014 picos afilados emergiendo de la sombra como un interior glacial',
    'portrait.commentary.blush': 'Radiancia rosa refractando a través de facetas cristalinas \u2014 la geometría vista desde dentro de su propia calidez',
    'portrait.commentary.veil': 'Planos cristalinos violeta fluyendo a través del crepúsculo \u2014 la estructura disolviéndose en atmósfera a corta distancia',
    'portrait.commentary.chlorophyll': 'Luz contenida en verde \u2014 como si la geometría misma estuviera fotosintentizando, convirtiendo estructura en calidez en silencio',

    /* ── Etiquetas de sección de galería ── */
    'gallery.generated': 'Generadas por el usuario',
    'gallery.custom': 'Personalizadas',
    'gallery.editor': 'Editar',
    'gallery.editing': '(Activo)',
    'gallery.addImage': 'Agregar imagen',

    /* ── Render queue menu ── */
    'renderQueue.title': 'Renders',
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
