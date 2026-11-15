:::writing{variant="document" id="58321"}
# Skill: Animatronic Teardown — Golden Freddy

## Objetivo
Desarrollar una aplicación web interactiva utilizando Three.js que permita visualizar, inspeccionar y desmontar un modelo 3D de Golden Freddy, inspirado en Five Nights at Freddy's 1.

El objetivo es conseguir una experiencia visual detallada, similar a un simulador de desmontaje de maquinaria.

## Requisito principal: modelo 3D

**NO construir Golden Freddy utilizando primitivas geométricas de Three.js.**

Queda prohibido generar el personaje mediante combinaciones de esferas, cilindros, cubos o geometrías básicas.

La aplicación debe cargar un modelo 3D externo en formato GLB o GLTF, proporcionado por el usuario.

Si no existe un modelo disponible, solicitarlo antes de implementar el visor. No sustituirlo por un modelo generado mediante código.

## Fidelidad visual

- Respetar la apariencia original de Golden Freddy de FNaF 1.
- Conservar las proporciones, materiales y texturas del modelo importado.
- No modificar arbitrariamente su geometría.
- Mantener su aspecto deteriorado y mecánico.
- No sustituir sus materiales originales por colores planos.

## Funcionalidades iniciales

1. Mostrar el modelo 3D completo.
2. Permitir rotación de cámara de 360°.
3. Implementar zoom mediante la rueda del mouse.
4. Permitir seleccionar piezas individuales.
5. Separar una pieza mediante una animación suave.
6. Devolver la pieza a su posición original.
7. Incorporar un botón para restaurar el modelo completo.

## Sistema de desmontaje

Las piezas deben identificarse a partir de las mallas reales del modelo importado.

No asumir que todas las partes están separadas.

Si una pieza forma parte de una malla combinada, indicar que necesita separarse previamente en Blender.

No eliminar vértices ni modificar la geometría original para simular un desmontaje.

## Estructura del proyecto

- `index.html`: interfaz principal.
- `style.css`: estilos visuales.
- `main.js`: escena Three.js y lógica de interacción.
- `assets/models/golden_freddy.glb`: modelo 3D.
- `assets/textures/`: texturas adicionales, si son necesarias.

## Restricciones

- No generar modelos aproximados utilizando geometrías básicas.
- No inventar componentes internos que no existan en el modelo.
- No implementar funcionalidades de desmontaje sobre piezas inexistentes.
- No reemplazar el modelo original por una representación simplificada.
- Priorizar fidelidad visual y funcionamiento correcto sobre cantidad de funcionalidades.

## Primera fase

Implementar exclusivamente:

- Carga del modelo GLB/GLTF.
- Iluminación adecuada.
- Cámara orbital.
- Zoom.
- Inspección de las mallas disponibles.

**No comenzar el desmontaje hasta comprobar que el modelo se visualiza correctamente y que sus piezas pueden identificarse.**
:::