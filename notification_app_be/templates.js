/**
 * STAGE 5: Notification Templates System
 */

const templates = {
  // Interview related templates
  "interview-scheduled": {
    title: "Interview Scheduled: {{companyName}}",
    message:
      "Your interview with {{companyName}} is scheduled for {{date}} at {{time}}. Please be prepared and arrive 15 minutes early.",
    priority: "high",
    variables: ["companyName", "date", "time"],
  },

  "interview-reminder": {
    title: "Interview Reminder: {{companyName}}",
    message:
      "Reminder: Your interview with {{companyName}} is tomorrow at {{time}}. Don't forget to prepare!",
    priority: "urgent",
    variables: ["companyName", "time"],
  },

  // Placement related templates
  "placement-offer": {
    title: "Congratulations! Job Offer from {{companyName}}",
    message:
      "Great news! You have received a job offer from {{companyName}} for the position of {{position}}. Salary: {{salary}}.",
    priority: "high",
    variables: ["companyName", "position", "salary"],
  },

  "placement-rejection": {
    title: "Update on Your Application",
    message:
      "Thank you for your interest in {{companyName}}. After careful consideration, we have decided to move forward with other candidates.",
    priority: "low",
    variables: ["companyName"],
  },

  // Event related templates
  "event-announcement": {
    title: "Upcoming Event: {{eventName}}",
    message:
      "{{eventName}} is happening on {{date}} at {{location}}. {{description}}. Don't miss out!",
    priority: "medium",
    variables: ["eventName", "date", "location", "description"],
  },

  // Selection related templates
  "selection-shortlisted": {
    title: "Congratulations! You've Been Shortlisted",
    message:
      "Great news! You have been shortlisted for the {{position}} role at {{companyName}}. Next steps will be communicated soon.",
    priority: "high",
    variables: ["position", "companyName"],
  },
};

class TemplateService {
  constructor() {
    this.templates = templates;
  }

  getTemplate(templateId) {
    return this.templates[templateId] || null;
  }

  getAllTemplates() {
    return Object.keys(this.templates).map((id) => ({
      id,
      ...this.templates[id],
    }));
  }

  renderTemplate(templateId, variables = {}) {
    const template = this.templates[templateId];
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    let title = template.title;
    let message = template.message;

    // Replace variables in title and message
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, "g");
      title = title.replace(regex, value || "");
      message = message.replace(regex, value || "");
    }

    return {
      title,
      message,
      priority: template.priority,
      type: this.inferType(templateId),
      metadata: variables,
    };
  }

  inferType(templateId) {
    if (templateId.includes("interview")) return "interview";
    if (templateId.includes("placement")) return "placement";
    if (templateId.includes("selection")) return "selection";
    if (templateId.includes("event")) return "event";
    return "announcement";
  }

  validateVariables(templateId, variables) {
    const template = this.templates[templateId];
    if (!template) return false; // Minor mistake: should throw error instead of returning false

    const requiredVars = template.variables || [];
    return requiredVars.every((varName) => variables.hasOwnProperty(varName));
  }

  // Create notification from template
  createFromTemplate(templateId, userId, variables = {}) {
    if (!this.validateVariables(templateId, variables)) {
      throw new Error("Missing required template variables");
    }

    const rendered = this.renderTemplate(templateId, variables);

    return {
      userId,
      type: rendered.type,
      title: rendered.title,
      message: rendered.message,
      priority: rendered.priority,
      metadata: {
        templateId,
        ...variables,
      },
    };
  }
}

module.exports = new TemplateService();
