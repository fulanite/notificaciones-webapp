import re
import os

# index.html
with open('index.html', 'r') as f:
    content = f.read()

new_buttons = """                                                        <button type="button" class="chip-btn chip-neutral" data-value="ley_22172_bus" onclick="app.selectNotificationType('ley_22172_bus', 'Ley 22.172 BUS', this)">Ley 22.172 BUS</button>
                                                        <button type="button" class="chip-btn chip-neutral" data-value="fuera_radio_sur_mandamientos" onclick="app.selectNotificationType('fuera_radio_sur_mandamientos', 'F. Radio Sur Mand.', this)">F. Radio Sur Mand.</button>
                                                        <button type="button" class="chip-btn chip-neutral" data-value="fuera_radio_norte_mandamientos" onclick="app.selectNotificationType('fuera_radio_norte_mandamientos', 'F. Radio Norte Mand.', this)">F. Radio Norte Mand.</button>"""

content = content.replace(
    '<button type="button" class="chip-btn chip-neutral" data-value="cedulas_mandamientos_22172" onclick="app.selectNotificationType(\'cedulas_mandamientos_22172\', \'Ley 22.172\', this)">Ley 22.172</button>',
    '<button type="button" class="chip-btn chip-neutral" data-value="cedulas_mandamientos_22172" onclick="app.selectNotificationType(\'cedulas_mandamientos_22172\', \'Ley 22.172\', this)">Ley 22.172</button>\n' + new_buttons
)

with open('index.html', 'w') as f:
    f.write(content)

# js/config.js
with open('js/config.js', 'r') as f:
    content = f.read()

content = content.replace(
    "cedulas_mandamientos_22172: 'Cédulas o Mandamientos Ley 22172',",
    "cedulas_mandamientos_22172: 'Cédulas o Mandamientos Ley 22172',\n        ley_22172_bus: 'Ley 22.172 BUS',\n        fuera_radio_sur_mandamientos: 'Fuera de Radio Sur Mandamientos',\n        fuera_radio_norte_mandamientos: 'Fuera de Radio Norte Mandamientos',"
)

with open('js/config.js', 'w') as f:
    f.write(content)

# js/data.js
with open('js/data.js', 'r') as f:
    content = f.read()

content = content.replace(
    "{ value: 'cedulas_mandamientos_22172', label: 'Cédulas o mandamientos Ley 22.172' },",
    "{ value: 'cedulas_mandamientos_22172', label: 'Cédulas o mandamientos Ley 22.172' },\n        { value: 'ley_22172_bus', label: 'Ley 22.172 BUS' },\n        { value: 'fuera_radio_sur_mandamientos', label: 'Fuera de Radio Sur Mandamientos' },\n        { value: 'fuera_radio_norte_mandamientos', label: 'Fuera de Radio Norte Mandamientos' },"
)

with open('js/data.js', 'w') as f:
    f.write(content)

# js/app.js
with open('js/app.js', 'r') as f:
    content = f.read()

content = content.replace(
    "tipo === 'cedulas_mandamientos_22172' ||\n                tipo === 'cedulas_correspondencia'",
    "tipo === 'cedulas_mandamientos_22172' ||\n                tipo === 'ley_22172_bus' ||\n                tipo === 'cedulas_correspondencia'"
)

content = content.replace(
    "if (tipo === 'cedulas_mandamientos_22172' || tipo === 'mandamientos_22172') {",
    "if (tipo === 'cedulas_mandamientos_22172' || tipo === 'mandamientos_22172' || tipo === 'ley_22172_bus') {"
)

with open('js/app.js', 'w') as f:
    f.write(content)

# js/reports.js
with open('js/reports.js', 'r') as f:
    content = f.read()

content = content.replace(
    "const esProvincia = tipoNot === 'cedulas_mandamientos_22172' || ",
    "const esProvincia = tipoNot === 'cedulas_mandamientos_22172' || tipoNot === 'ley_22172_bus' || "
)

with open('js/reports.js', 'w') as f:
    f.write(content)

print("Done")
