import re

# Update index.html
with open('index.html', 'r') as f:
    content = f.read()
content = re.sub(r'v1\.7\.\d+', 'v1.7.5', content)
with open('index.html', 'w') as f:
    f.write(content)

# Update js/config.js
with open('js/config.js', 'r') as f:
    content = f.read()
content = re.sub(r"APP_VERSION: '1\.7\.\d+'", "APP_VERSION: '1.7.5'", content)
with open('js/config.js', 'w') as f:
    f.write(content)
