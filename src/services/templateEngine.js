const fs = require('fs').promises;
const path = require('path');

class TemplateEngine {
  constructor() {
    this.layoutsDir = path.join(__dirname, '../web/views/layouts');
    this.viewsDir = path.join(__dirname, '../web/views');
  }

  async render(viewName, data = {}) {
    try {
      // Read base layout
      const baseLayout = await fs.readFile(
        path.join(this.layoutsDir, 'base.html'),
        'utf8'
      );

      // Read content view
      const contentView = await fs.readFile(
        path.join(this.viewsDir, `${viewName}.html`),
        'utf8'
      );

      // Replace placeholders in base layout
      let rendered = baseLayout
        .replace('{{title}}', data.title || 'WhatsApp Bot')
        .replace('{{scripts}}', data.scripts || '')
        .replace('{{content}}', contentView)
        .replace('{{additionalStyles}}', data.additionalStyles || '');

      return rendered;
    } catch (error) {
      console.error('Template rendering error:', error);
      throw error;
    }
  }
}

module.exports = new TemplateEngine();
