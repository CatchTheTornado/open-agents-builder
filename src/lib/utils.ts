import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { ZodError, ZodIssue, string } from "zod"

import chalk from 'chalk'
import dedent from 'dedent'
import { Price } from "@/data/client/models"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


type ErrorWithMessage = {
	message: string
}

function isErrorWithMessage(error: unknown): error is ErrorWithMessage {
	return (
		typeof error === 'object' &&
		error !== null &&
		'message' in error &&
		typeof (error as Record<string, unknown>).message === 'string'
	)
}

function toErrorWithMessage(maybeError: unknown): ErrorWithMessage {
	if (isErrorWithMessage(maybeError)) return maybeError

	try {
		return new Error(JSON.stringify(maybeError))
	} catch {
		// fallback in case there's an error stringifying the maybeError
		// like with circular references for example.
		return new Error(String(maybeError))
	}
}


export function formatZodError(err: unknown) {
  let errorChunk = { type: "error", message: getErrorMessage(err) };

  if (err instanceof ZodError) {
    // Format each issue so it’s easier to read in one string
    const formattedIssues = err.issues
      .map((issue) => {
        const path = issue.path.join(".");
        const validation = issue.validation || issue.code; // Some ZodError issues won't have 'validation'
        return `Path: **${path}**; Validation: **${validation}**; Message: **${issue.message}**`;
      })
      .join("\n\n"); // separate each issue with a blank line

    errorChunk = {
      flowNodeId: nanoid(),
      ...err,
      // Replace default `message` with a more nicely formatted version
      message: formattedIssues,
      name: "error",
      type: "error",
    };
  }

  return errorChunk;
}



import axios, { AxiosError } from 'axios';
import { nanoid } from "nanoid"

/**
 * Formats an Axios error into a readable error message.
 * @param error - The error object thrown by an Axios request.
 * @returns A formatted error message string.
 */
export function formatAxiosError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status || 'Unknown Status';
    const data = error.response?.data;

    let errorMessage = `HTTP Error ${status}`;

    if (data) {
      if (typeof data === 'string') {
        errorMessage += `: ${data}`;
      } else if (typeof data === 'object') {
        errorMessage += `: ${JSON.stringify(data, null, 2)}`;
      }
    } else {
      errorMessage += `: ${error.message}`;
    }

    return errorMessage;
  }

  return `Unexpected error: ${error instanceof Error ? error.message : String(error)}`;
}

/**
 * Wrapper function to handle Axios errors gracefully.
 * @param callback - The async function to execute.
 */
async function safeRequest<T>(callback: () => Promise<T>): Promise<T> {
  try {
    return await callback();
  } catch (error) {
    throw new Error(formatAxiosError(error));
  }
}


export function getErrorMessage(error: unknown) {
	return toErrorWithMessage(error).message
}

export function getZedErrorMessage(error: ZodError) {
	return error.errors.map((e:ZodIssue) => e.path[0] + ': ' + e.message).join(', ')
}


export function getCurrentTS(): string {
  return getTS();
}
export function getTS(now = new Date()): string {   
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    const formattedDate = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    
    return formattedDate;   
}


function getLineNumber(text = '', matches: any) {
    return countLines(text.substr(0, matches.index))
}

function countLines(text = '') {
    return text.split('\n').length
}


const PATTERN = /^([A-Za-z \t]*)```([A-Za-z]*)?\n([\s\S]*?)```([A-Za-z \t]*)*$/gm

export function removeCodeBlocks(text: string) {
  return text.replace(PATTERN, '');
}

export function findCodeBlocks(block: string, singleBlockMode = true) {
  let matches
  let errors = []
  let blocks = []
  while ((matches = PATTERN.exec(block)) !== null) {
    if (matches.index === PATTERN.lastIndex) {
      PATTERN.lastIndex++ // avoid infinite loops with zero-width matches
    }
    const [ match, prefix, syntax, content, postFix ] = matches
    const lang = syntax || 'none'
    const lineNumber = getLineNumber(block, matches)
    let hasError = false

    /* Validate code blocks */
    if (prefix && prefix.match(/\S/)) {
      hasError = true
      errors.push({
        line: lineNumber,
        position: matches.index,
        message: `Prefix "${prefix}" not allowed on line ${lineNumber}. Remove it to fix the code block.`,
        block: match
      })
    }
    if (postFix && postFix.match(/\S/)) {
      hasError = true
      const line = lineNumber + (countLines(match) - 1)
      errors.push({
        line,
        position: matches.index + match.length,
        message: `Postfix "${postFix}" not allowed on line ${line}. Remove it to fix the code block.`,
        block: match
      })
    }

    if (!hasError) {
      blocks.push({
        line: lineNumber,
        position: matches.index,
        syntax: lang,
        block: match,
        code: content.trim()
      })
    }
  }

  if (blocks.length === 0 && singleBlockMode) {
    blocks.push({
        line: 0,
        position:0,
        syntax: '',
        block: '',
        code: block.trim()
      })    
  }

  return {
    errors,
    blocks
  }
}


export function formatDate(date: Date) {
  return date.toLocaleString()
}

/**
 * Get API key from environment variables or prompt user for it.
 */
export function checkApiKey(name: string, key: string, value: string): string {
  if (value) return value;

  console.log(dedent`
    ${chalk.bold(`Please provide your ${name} API key.`)}

    Set ${chalk.bold(key)} env variable, and run again. 
    
    You can do it in three ways:
    - by creating an ${chalk.bold('.env.local')} file (make sure to ${chalk.bold('.gitignore')} it)
      ${chalk.gray(`\`\`\`
        ${key}=<your-key>
        \`\`\`
      `)}
    - by setting it as an env variable in your shell (e.g. in ~/.zshrc or ~/.bashrc):
      ${chalk.gray(`\`\`\`
        export ${key}=<your-key>
        \`\`\`
      `)},
    `);

  throw Error(`Please provide the ${name} in the environment variable ${key}`);
}

export function safeJsonParse(str: string, defaultValue: any) {
  try {
    return JSON.parse(str);
  } catch {
    return defaultValue;
  }
};


export function createPrice(value: number, currency: string): Price {
  return { value: Number(value.toFixed(2)), currency };
}

