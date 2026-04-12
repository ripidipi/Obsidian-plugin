# Obsidian ai plugin

* The plugin is written with the active use of llm and this is part of the idea of quickly creating a working utility for yourself.

### Step 1: Installation

#### Where to Put the Plugin

* Move the project to the following directory:
  ```
  .../Obsidian Vault/.obsidian/plugins/
  ```

#### Building the Plugin

* Install required Node.js modules:
  ```bash
  npm init -y
  npm install esbuild obsidian
  ```
* Build the plugin:
  ```bash
  npm run build
  ```

### Step 2: Hugging Face Settings

* Go to Obsidian plugin settings
* Set your **Hugging Face API Key** (obtained from: <https://huggingface.co/settings/tokens>)
* Choose a suitable **Model** (available at: <https://huggingface.co/models?pipeline_tag=text-generation&sort=likes>)


### Step 3: Using

For start open command menu inside Obsidian and print **AI Assist** 

* Use one of two mode
- chat version 
- quick change 

### Step 4: Changes

* Modify the plugin code as needed, no rule!!!