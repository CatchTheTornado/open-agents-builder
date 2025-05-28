import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * 1) Basic HTML-escaper used in the "|escape" (or "|e") filter.
 */
function escapeHtml(input: any): string {
  const str = String(input ?? '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * 2) Retrieve a nested value from `context` by splitting on "."
 *    e.g. getValueFromContext("user.name", { user: { name: "Alice" } }) -> "Alice"
 */
function getValueFromContext(varPath: string, context: any): any {
  return varPath
    .split('.')
    .reduce((acc, key) => acc && acc[key], context);
}

/**
 * 3) Evaluate the condition in {% if condition %}.
 *
 *    - A very naive approach: if `conditionExpr` is a simple variable path,
 *      we get its value from the context and do a truthy check.
 *    - If you need advanced boolean logic or comparisons, you'll have to parse
 *      or safely evaluate the expression. (Beware of security risks with `eval`!)
 */
function evaluateCondition(conditionExpr: string, context: any): boolean {
  // Try to interpret `conditionExpr` as a variable path:
  // e.g. {% if user %} => check truthiness of `context.user`
  // If needed, parse more complex expressions here.
  const value = getValueFromContext(conditionExpr, context);
  return !!value;
}

/**
 * 4) Parse if-blocks of the form:
 *
 *    {% if something %}
 *      ...
 *    {% else %}
 *      ...
 *    {% endif %}
 *
 *    We find each block, evaluate the condition, and replace the block
 *    with the "then" content or the "else" content.
 *
 *    NOTE: This is naive and doesn't handle nested `if` blocks robustly.
 */
function parseIfBlocks(
  template: string,
  context: any,
  filters: Record<string, (arg: any) => string>
): string {
  // Regex captures:
  //   1) the condition expression
  //   2) the block content (including possible {% else %})
  const ifBlockRegex =
    /{%\s*if\s+(.+?)\s*%}([\s\S]*?){%\s*endif\s*%}/;

  let match = ifBlockRegex.exec(template);
  while (match) {
    const [fullMatch, conditionExpr, blockContent] = match;

    // Check for optional {% else %} inside the blockContent
    let elseContent = '';
    let thenContent = blockContent;

    const elseRegex = /{%\s*else\s*%}([\s\S]*)$/;
    const elseMatch = elseRegex.exec(blockContent);
    if (elseMatch) {
      thenContent = blockContent.slice(0, elseMatch.index);
      elseContent = elseMatch[1];
    }

    // Evaluate condition
    const conditionResult = evaluateCondition(conditionExpr, context);

    // If condition is truthy, keep the "thenContent"
    // otherwise, keep the "elseContent"
    let chosenContent = conditionResult ? thenContent : elseContent;

    // -- Recursively parse nested if-blocks within the chosen content
    chosenContent = parseIfBlocks(chosenContent, context, filters);

    // -- Also parse nested for-blocks inside this chunk
    chosenContent = parseForBlocks(chosenContent, context, filters);

    // -- And do variable replacement
    chosenContent = replaceVariables(chosenContent, context, filters);

    // Replace the entire if-block in the template
    template =
      template.slice(0, match.index) +
      chosenContent +
      template.slice(match.index + fullMatch.length);

    match = ifBlockRegex.exec(template);
  }

  return template;
}

/**
 * 5) Parse for-blocks of the form:
 *
 *    {% for user in users %}
 *      ...
 *    {% else %}
 *      ...
 *    {% endfor %}
 *
 *    We find each block, replace the content with repeated content
 *    for each item in the array, or use the "else" block if array is empty.
 *
 *    NOTE: This is naive and doesn't handle nested loops robustly.
 */
function parseForBlocks(
  template: string,
  context: any,
  filters: Record<string, (arg: any) => string>
): string {
  const forBlockRegex =
    /{%\s*for\s+(\w+)\s+in\s+(\w+)\s*%}([\s\S]*?){%\s*endfor\s*%}/;

  let match = forBlockRegex.exec(template);
  while (match) {
    const [fullMatch, itemVar, arrayVar, blockContent] = match;

    let elseContent = '';
    let innerContent = blockContent;

    // Check for optional {% else %} inside the blockContent
    const elseRegex = /{%\s*else\s*%}([\s\S]*)$/;
    const elseMatch = elseRegex.exec(blockContent);
    if (elseMatch) {
      innerContent = blockContent.slice(0, elseMatch.index);
      elseContent = elseMatch[1];
    }

    // Resolve array from context
    const arr = getValueFromContext(arrayVar, context) || [];
    let replacement = '';
    if (Array.isArray(arr) && arr.length > 0) {
      for (const item of arr) {
        // Extend context with current item
        const newContext = { ...context, [itemVar]: item };

        // Recursively parse if/for/variables in the loop content
        let parsed = parseIfBlocks(innerContent, newContext, filters);
        parsed = parseForBlocks(parsed, newContext, filters);
        parsed = replaceVariables(parsed, newContext, filters);

        replacement += parsed;
      }
    } else 
    if (Object.values(arr).length > 0) {
      for (const item of Object.values(arr)) {
        // Extend context with current item
        const newContext = { ...context, [itemVar]: item };

        // Recursively parse if/for/variables in the loop content
        let parsed = parseIfBlocks(innerContent, newContext, filters);
        parsed = parseForBlocks(parsed, newContext, filters);
        parsed = replaceVariables(parsed, newContext, filters);

        replacement += parsed;
      }      
    }
    else {
      // If array is empty, parse the else block
      let parsedElse = parseIfBlocks(elseContent, context, filters);
      parsedElse = parseForBlocks(parsedElse, context, filters);
      parsedElse = replaceVariables(parsedElse, context, filters);
      replacement = parsedElse;
    }

    // Replace entire block with the loop expansion
    template =
      template.slice(0, match.index) +
      replacement +
      template.slice(match.index + fullMatch.length);

    match = forBlockRegex.exec(template);
  }

  return template;
}

/**
 * 6) Replace variable placeholders of the form:
 *
 *    {{ var }}
 *    {{ var|escape }} or {{ var|e }}
 *    {{ var|someCustomFilter }}
 *
 *    We allow chaining of filters in a naive way if you wish
 *    (e.g. {{ var|escape|uppercase }} ), but the code below
 *    only demonstrates a single filter usage for clarity.
 */
function replaceVariables(
  template: string,
  context: any,
  filters: Record<string, (arg: any) => string>
): string {
  return template.replace(/\{\{\s*(.*?)\s*\}\}/g, (_, expr) => {
    // e.g., "user.name|escape"
    const parts = expr.split('|').map((p) => p.trim());
    const varPath = parts.shift() ?? '';

    let value = getValueFromContext(varPath, context) ?? '';

    // Apply each filter if exists
    for (const filterName of parts) {
      // If user typed "|e", treat as "|escape"
      const fn =
        filters[filterName] ||
        (filterName === 'e' ? filters['escape'] : undefined);
      if (typeof fn === 'function') {
        value = fn(value);
      }
    }

    return String(value);
  });
}

/**
 * 7) Main rendering function that:
 *    - parses if-blocks
 *    - parses for-blocks
 *    - replaces variables
 */
export function renderTemplate(
  template: string,
  context: any,
  customFilters: Record<string, (arg: any) => string> = {}
): string {
  // Merge built-in filters with custom filters
  const filters = {
    escape: escapeHtml,
    e: escapeHtml, // short alias
    ...customFilters,
  };

  // 1) Parse {% if %}
  template = parseIfBlocks(template, context, filters);

  // 2) Parse {% for %}
  template = parseForBlocks(template, context, filters);

  // 3) Finally, replace {{ var }} placeholders
  template = replaceVariables(template, context, filters);

  return template;
}

/**
 * 8) Load a .md file from:
 *      app root + '/prompts/' + localeName + '/' + promptName + '.md'
 *    and then render it using our extended templating system.
 */
export async function renderPrompt(
  localeName: string,
  promptName: string,
  context: any = {},
  customFilters: Record<string, (arg: any) => string> = {}
): Promise<string> {
  const filePath = path.join(
    process.cwd(), // or your app root logic
    'src',
    'prompts',
    localeName,
    `${promptName}.md`
  );
  const template = await fs.readFile(filePath, 'utf8');
  return renderTemplate(template, context, customFilters);
}

/**
 * Get the locale from the Agent-Locale header
 */
export function getLocale(request: Request): string {
  return request.headers.get('Agent-Locale') || 'en';
}
