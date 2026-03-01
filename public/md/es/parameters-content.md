La salida visual de Interior Geométrico se configura mediante parámetros en seis grupos: **geometría**, **luz**, **color**, **espacio**, **semilla** y **cámara**. Los primeros once son ejes continuos de 0 a 1 que definen la composición. La semilla controla la disposición geométrica específica. Los parámetros de cámara encuadran la vista. En modo animación, parámetros adicionales de **animación** modulan la escena a lo largo del tiempo.

---

## Geometría

### density

**Abundancia** — cuán poblado está el espacio.

Controla el número total de elementos geométricos en todos los niveles: curvas guía, cadenas plegables, puntos principales, puntos medios, dispersión interior y micropartículas. Una mayor densidad produce composiciones más ricas y complejas, pero aumenta el riesgo de saturación aditiva. Un sistema de opacidad adaptativo compensa escalando la opacidad de las caras en conteos altos.

- **0.0**: Escaso. Los elementos geométricos individuales son claramente legibles. Estelar.
- **0.5**: Equilibrado. Estructura rica sin perder legibilidad.
- **1.0**: Denso. Geometría abundante — atmosférico, nebular.

### fracture

**Fragmentación** — cuán fracturada o íntegra es la geometría.

Controla el grado de dispersión geométrica en todos los subsistemas simultáneamente: radios de la envolvente, curvatura de las curvas guía, extensión de cadenas, radio de dispersión de puntos y aberración cromática. Cada subsistema responde "¿cuán roto?" en la misma dirección perceptual.

- **0.0**: Compacto e íntegro. Agrupación cerrada, curvas suaves, dispersión mínima. Cristalino.
- **0.5**: Fragmentación moderada. Estructura visible con algo de dispersión.
- **1.0**: Altamente fracturado. Fragmentos dispersos, amplia extensión, geometría angular. Explosivo.

### scale

**Granularidad** — la distribución de tamaños de los elementos geométricos.

Controla el equilibrio entre niveles sin cambiar el conteo total de elementos. En valores bajos, las cadenas primarias y los puntos principales dominan — unas pocas formas geométricas audaces. En valores altos, las cadenas terciarias y las micropartículas dominan — una nube de partículas finas. Independiente de la densidad.

- **0.0**: Monumental. Pocas formas geométricas grandes y audaces. Presencia arquitectónica.
- **0.5**: Mezcla equilibrada de elementos primarios, secundarios y terciarios.
- **1.0**: Atmosférico. Muchas partículas pequeñas y cadenas finas. Nebular, difuso.

### division

**Topología** — la forma a gran escala de la estructura.

Controla la ruptura de simetría de la envolvente mediante la profundidad y cantidad de surcos. La envolvente es un elipsoide perturbado; los surcos tallados en ella crean lóbulos distintos.

- **0.0**: Un solo lóbulo. Unificado, centrado, esférico.
- **0.5**: Dos lóbulos. Bifurcado — la estructura característica de doble núcleo.
- **1.0**: Tres lóbulos. Trifurcado — una disposición triangular de núcleos luminosos.

### faceting

**Carácter cristalino** — la cualidad de las caras geométricas individuales.

Controla la geometría local de cada eslabón de cadena plegable: la proporción de cuadriláteros amplios a triángulos agudos, el ángulo diedro de plegado y la tasa de contracción. Estas propiedades determinan si los fragmentos individuales se perciben como paneles suaves o cristales angulares.

- **0.0**: Paneles amplios y planos. Mayormente cuadriláteros, pliegues suaves. Abierto, planar.
- **0.5**: Carácter mixto. Ángulos diedros moderados.
- **1.0**: Fragmentos agudos y angulares. Mayormente triángulos, pliegues agresivos. Cristales en espiral.

---

## Luz

### luminosity

**Energía** — el brillo general y la intensidad del resplandor.

Controla la intensidad del resplandor por elemento, los factores de iluminación y el bloom de posprocesamiento. Un sistema de atenuación adaptativo previene la saturación en escenas densas. El rango completo de 0 a 1 es utilizable: en 0, las escenas son tenues pero claramente visibles; en 1, brillantes pero no quemadas.

- **0.0**: Oscuro. Resplandor sutil, colores saturados y ricos. Íntimo, contemplativo.
- **0.5**: Energía moderada. Brillo equilibrado.
- **1.0**: Brillante. Resplandor fuerte y bloom. Radiante, luminoso.

---

## Color

El color es parte integral del espacio de parámetros continuo. Tres ejes definen la identidad cromática de la luz emitida. Los colores de niebla y fondo se derivan automáticamente.

### hue

**Identidad cromática** — la longitud de onda dominante de la luz emitida.

Se mapea linealmente al círculo de matiz: `baseHue = hue × 360°`. El matiz determina el carácter cromático general de la escena y tiñe la niebla y el fondo.

- **0.06** (22°): Ámbar/dorado cálido
- **0.51** (185°): Verde azulado fresco
- **0.63** (225°): Azul zafiro
- **0.78** (282°): Violeta — el aspecto clásico
- **0.87** (312°): Amatista/magenta

### spectrum

**Rango cromático** — la amplitud de variación de matiz, de monocromático a prismático.

Controla cuánto varían los colores de los elementos individuales alrededor del matiz dominante. Mapeado cuadráticamente para uniformidad perceptual.

- **0.0**: Casi monocromático. Todos los elementos comparten el matiz dominante.
- **0.24**: Rango moderado. Variación sutil — el aspecto clásico de profundidad violeta.
- **1.0**: Completamente prismático. Todos los matices presentes. Arcoíris.

### chroma

**Intensidad cromática** — cuán vívidos son los colores.

Controla la saturación del color desde casi acromático hasta completamente vívido. También afecta el tintado de la niebla: con baja croma, la niebla es neutra; con alta croma, la niebla adopta el matiz dominante. La croma no solo cambia los elementos — cambia el espacio mismo.

- **0.0**: Acromático. Geometría casi en escala de grises, niebla neutra. Estructura pura.
- **0.5**: Saturación moderada. Color presente pero no dominante.
- **1.0**: Completamente vívido. Color intenso y saturado.

---

## Espacio

### coherence

**Organización** — cuán fuertemente los elementos siguen el patrón de flujo.

Controla la influencia del campo de flujo sobre la orientación de las cadenas y la escala de ruido del campo de flujo. La coherencia también afecta la organización cromática: una alta coherencia crea parches tanto geométricos como cromáticos.

- **0.0**: Caótico. Las cadenas se orientan aleatoriamente. Sin estructura direccional.
- **0.5**: Organización moderada. Alineación sutil.
- **1.0**: Altamente organizado. Fuerte alineación direccional. Patrones de flujo visibles.

### flow

**Patrón espacial** — la forma del campo direccional.

Controla qué patrón espacial adopta el campo de flujo. El flujo define la forma de la organización; la coherencia define su intensidad. Con baja coherencia, el flujo es irrelevante — las cadenas se orientan aleatoriamente sin importar el patrón.

- **0.0**: Radial. Las cadenas emanan hacia afuera desde el núcleo. Estallido estelar.
- **0.5**: Ruido. Campo de ruido Perlin. Orgánico, sin dirección preferida.
- **1.0**: Orbital. Las cadenas se envuelven tangencialmente alrededor de la forma. Bandas atmosféricas.

---

## Semilla

La semilla determina la disposición geométrica específica dentro del espacio de parámetros. Dos composiciones con los mismos controles pero diferentes semillas producen imágenes visualmente relacionadas — mismo ambiente, paleta y estructura — pero con ubicación de elementos distinta.

La semilla es una etiqueta de tres ranuras: **[disposición, estructura, detalle]**. Cada ranura es un número (0–17) que corresponde a una palabra en un espectro perceptual. Las tres ranuras controlan aspectos independientes de la aleatoriedad de la escena.

### arrangement

**Disposición espacial** — cómo se distribuyen los elementos en el espacio.

Controla la ubicación de curvas guía y puntos de luz. Las palabras van de quieto a turbulento: *anclado, equilibrado, centrado, asentado, en reposo, balanceado, a la deriva, inclinado, cambiante, fluido, girando, arqueado, arremolinado, precipitado, disperso, divergente, en espiral, turbulento*.

Valores cercanos producen disposiciones espaciales similares. Valores distantes producen composiciones notablemente diferentes.

### structure

**Forma geométrica** — cómo se drapeán y pliegan las cadenas.

Controla la dirección de drapeado, los ángulos de pliegue y la construcción geométrica de las cadenas. Las palabras van de suave a dentado: *sedoso, drapeado, liso, plegado, estratificado, tejido, arrugado, plisado, angular, facetado, tallado, fracturado, astillado, destrozado, cristalino, serrado, erizado, dentado*.

### detail

**Variación fina** — fluctuación cromática y dispersión atmosférica.

Controla la variación de color por elemento y la ubicación de elementos atmosféricos. Las palabras van de congelado a abrasador: *congelado, glacial, quieto, fresco, brumoso, tenue, crepuscular, neutro, suave, cálido, resplandeciente, brillante, vívido, radiante, ardiente, fundido, incandescente, abrasador*.

Cada ranura aporta tanto un **sesgo** sutil (la posición en el espectro empuja la salida en una dirección consistente) como un **flujo aleatorio** independiente (variación de grano fino). Esto significa que semillas con ranuras compartidas producen resultados visiblemente relacionados, y el grado de diferencia visual escala con la distancia numérica entre los valores de las ranuras.

---

## Cámara

Los parámetros de cámara encuadran la composición. Se aplican tanto a imágenes estáticas como a animaciones. En modo animación, los valores de cámara pueden animarse a lo largo del tiempo entre eventos.

### zoom

**Proximidad** — cuán cerca está la cámara de la escena.

Un multiplicador sobre la distancia predeterminada de la cámara. Valores por debajo de 1.0 acercan la cámara (ampliando el centro); valores por encima de 1.0 la alejan (mostrando más periferia).

- **0.5**: Cerca. El núcleo luminoso llena el encuadre.
- **1.0**: Predeterminado. El encuadre estándar.
- **2.0**: Distante. La forma completa visible con espacio oscuro circundante.

### rotation

**Órbita** — la posición angular de la cámara alrededor de la escena.

Rota la cámara alrededor del eje vertical de la escena. Útil para encontrar el ángulo más atractivo en composiciones asimétricas (especialmente con división distinta de cero).

- **0°**: Vista frontal predeterminada.
- **90°**: Vista lateral — revela profundidad y capas.
- **180°**: Vista posterior — la forma vista desde atrás.

En animación, la rotación puede barrerse continuamente para crear movimientos orbitales de cámara.

---

## Animación

Los parámetros de animación modulan la escena existente en tiempo real. A diferencia de los once parámetros de control (que definen la geometría y requieren reconstruir la escena para cambiar), los parámetros de animación se aplican como modulaciones a nivel de shader — son continuos, ligeros y pueden variar cuadro a cuadro.

### twinkle

**Juego de luz** — cuánto danzan los puntos luminosos.

Controla la oscilación y el pulso de los puntos de luz. En cero, los puntos están perfectamente quietos. A medida que aumenta el centelleo, los puntos oscilan en posición, pulsan en tamaño y su brillo superficial parpadea con variación temporal. El efecto es orgánico y vivo — como luz refractándose a través de agua en movimiento.

- **0.0**: Estático. Los puntos son puntos fijos de luz. Sereno, cristalino.
- **0.5**: Pulso suave. Cualidad sutil de respiración.
- **1.0**: Oscilación completa. Puntos de luz danzantes y parpadeantes.

### dynamism

**Vida superficial** — cuánto cambian y evolucionan las caras geométricas.

Controla la velocidad de animación de los patrones superficiales en las caras de las cadenas plegables — las texturas de grietas, patrones de polvo y detalles de superficie que dan carácter a cada cara. En cero, las superficies están congeladas en el tiempo. A medida que aumenta el dinamismo, estos patrones derivan y evolucionan, dando a la geometría una sensación de lento movimiento geológico.

- **0.0**: Congelado. Las superficies están fijas. Quieto, atemporal.
- **0.5**: Deriva suave. Evolución superficial sutil.
- **1.0**: Movimiento activo. Flujo visible de patrones a través de las caras.

---

## Interacciones entre Parámetros

Aunque cada parámetro es controlable de forma independiente, ciertos pares crean espacios de interacción especialmente ricos:

**coherence × flow** — La interacción espacial definitoria. La coherencia controla la fuerza de alineación; el flujo controla hacia qué se alinea. La combinación abarca desde ruido caótico, pasando por estallidos radiales, hasta estructuras de anillos orbitales.

**density × scale** — Juntos definen qué llena el espacio. Alta densidad + baja escala = estructuras masivas empaquetadas. Baja densidad + alta escala = una nube dispersa de partículas diminutas.

**fracture × faceting** — Ambos afectan el carácter geométrico pero a diferentes escalas. La fractura controla el patrón de dispersión global. El facetado controla la cualidad local de las caras. Se pueden tener fragmentos agudos agrupados o paneles suaves dispersos.

**luminosity × chroma** — Juntos definen la calidad de la luz. Baja luminosidad + alta croma = colores profundos y ricamente saturados. Alta luminosidad + baja croma = resplandor blanco brillante. El modo oscuro (luminosidad=0) es un espacio creativo viable.

**spectrum × chroma** — El espacio del carácter cromático. Bajo espectro + baja croma = red cristalina acromática. Bajo espectro + alta croma = monocromático vívido. Alto espectro + alta croma = prismático vívido.

**seed × controls** — La semilla y los controles operan en ejes completamente diferentes. Los controles definen el carácter visual; la semilla define la realización específica. Explorar semillas con controles fijos revela el espacio de disposiciones posibles dentro de una misma estética.

**twinkle × dynamism** — En animación, juntos definen la vitalidad de la escena. Bajo centelleo + bajo dinamismo = quieto, contemplativo. Alto centelleo + bajo dinamismo = brillante pero estable. Ambos altos = energía cinética completa.
