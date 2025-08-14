# Overview
This is a web application that enables even beginners in Kubernetes to visually create Pod definition files without needing to memorize complex YAML syntax. Simply fill in the required settings in the form on the left, and a valid YAML manifest will be generated in real-time on the right.

## Key Features
- Real-time YAML Generation: The YAML preview on the right is instantly updated as you input settings into the form on the left.

- User-Friendly Interface: Technical terms are simplified where possible (e.g., Probe is labeled as "Health Check") to provide an intuitive user experience.

- "Commented YAML" Mode: By flipping the switch in the top-right corner, you can generate YAML with explanatory comments for each configuration field, making it an excellent tool for learning.

- Dynamic Field Addition: You can add as many items as you need, such as labels, environment variables, and volumes, by clicking the "+ Add" buttons.

- Comprehensive Configuration: Covers a wide range of practical settings, including initContainers and probes (health checks), allowing you to create production-ready manifests.

- Copy & Save YAML: The generated YAML can be easily copied to your clipboard with the "Copy" button or downloaded as a .yaml file with the "Save" button.

# How to Use
1. Save the three downloaded files (index.html, style.css, script.js) into the same folder on your computer.

1. Open the index.html file in your preferred web browser (e.g., Google Chrome, Firefox).

1. Enter your desired configurations into the form on the left side of the page.

1. Review the generated YAML on the right side, and then use the "Copy" or "Save" buttons.

## Tech Stack
- HTML

- CSS

- Vanilla JavaScript (No external libraries or frameworks are used.)