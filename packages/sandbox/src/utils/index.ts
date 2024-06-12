import { splitCodeImports } from '@es-js/core/utils'
import {
	IMPORT_ESJS_PRUEBA,
	IMPORT_ESJS_TERMINAL,
} from '../compiler/constants'
import { MAIN_FILE, MAIN_TESTS_FILE } from '../compiler/orchestrator'
import type { ProcessSandboxedCodeOptions } from '../runtime/ejecutar'
import { applyTransformers } from '../transformers'
import { ExportFunctionsTransformer } from '../transformers/exportFunctions.transformer'
import { FormatTransformer } from '../transformers/format.transformer'
import { InfiniteLoopProtectionTransformer } from '../transformers/infiniteLoopProtection.transformer'
import { generateImportFunctions } from './generateImportFunctions'
import { unifyImports } from './unifyImports'
import { codeFrameColumns } from './codeFrameColumns'

class ProcessSandboxedCodeError extends Error {
	constructor(
		message: string,
		public line: number,
		public column: number,
	) {
		super(message)
	}
}

export interface SandboxFile {
	name: string
	content: string
	main?: boolean
	compiled?: {
		esjs?: string
		js?: string
	}
	sandboxed?: {
		imports: string
		codeWithoutImports: string
	}
	error?: SandboxFileError
}

export interface SandboxFileError {
	message: string
	line: number
	column: number
	stack: string
}

export function processSandboxedFiles(
	files: SandboxFile[],
	options: ProcessSandboxedCodeOptions,
) {
	if (files.some((file) => file.error)) {
		const firstFileWithError = files.find((file) => file.error)

		if (!firstFileWithError?.error) {
			return files
		}

		return printError(firstFileWithError)
	}

	const main = prepareMainFile(
		files.find((file: any) => file.name === MAIN_FILE),
		options,
	)

	if (main.error) {
		return printError(main)
	}

	const restOfFiles = files
		.filter((file: any) => file.name !== MAIN_FILE)
		.map((file) => prepareOtherFile(file, main, options))

	if (restOfFiles.some((file) => file.error)) {
		const firstFileWithError = restOfFiles.find((file) => file.error)

		if (!firstFileWithError?.error) {
			return restOfFiles
		}

		return printError(firstFileWithError)
	}

	const sandboxedFiles = [main, ...restOfFiles]

	parent.postMessage({
		action: 'cmd_files_compiled',
		filesCompiled: sandboxedFiles,
	})

	return sandboxedFiles
}

export function processSandboxedCode(
	code: string,
	options?: ProcessSandboxedCodeOptions,
) {
	try {
		return applyTransformers(code, [
			...(options?.preFormat ? [new FormatTransformer()] : []),
			...(options?.exportFunctions ? [new ExportFunctionsTransformer()] : []),
			...(options?.infiniteLoopProtection
				? [new InfiniteLoopProtectionTransformer()]
				: []),
			new FormatTransformer(),
		])
	} catch (error: any) {
		const errorMessage = error.message
		const line = error?.loc?.start?.line || 1
		const column = error?.loc?.start?.column || 1

		throw new ProcessSandboxedCodeError(errorMessage, line, column)
	}
}

function prepareMainFile(
	file: SandboxFile,
	options?: ProcessSandboxedCodeOptions,
) {
	try {
		const sandboxedCode = processSandboxedCode(file?.compiled?.js || '', {
			...options,
			exportFunctions: true,
		})

		const split = splitCodeImports(sandboxedCode)

		const codeUsesTerminal = split.codeWithoutImports.includes('Terminal')

		const imports = unifyImports(`
${codeUsesTerminal ? IMPORT_ESJS_TERMINAL : ''}
${IMPORT_ESJS_PRUEBA}
${split.imports}
  `)

		return {
			...file,
			sandboxed: {
				imports,
				codeWithoutImports: split.codeWithoutImports,
			},
		}
	} catch (error: any) {
		return {
			...file,
			error: {
				message: error.message,
				line: error.line,
				column: error.column,
				stack: error.stack,
			},
		}
	}
}

function prepareOtherFile(
	file: any,
	main: any,
	options: ProcessSandboxedCodeOptions,
) {
	try {
		const importsFromMain = generateImportFunctions({
			code: main.sandboxed.codeWithoutImports,
			modulePath: `./${MAIN_FILE}`,
		})
		const sandboxedCode = processSandboxedCode(
			file?.compiled?.js || '',
			options,
		)
		const split = splitCodeImports(sandboxedCode)
		const imports = unifyImports(`
      ${importsFromMain}
      ${split.imports}
      ${file.name === MAIN_TESTS_FILE ? IMPORT_ESJS_PRUEBA : ''}
    `)

		return {
			...file,
			sandboxed: {
				imports,
				codeWithoutImports: split.codeWithoutImports,
			},
		}
	} catch (error: any) {
		return {
			...file,
			error: {
				message: error.message,
				line: error.line,
				column: error.column,
				stack: error.stack,
			},
		}
	}
}

function printError(file: SandboxFile) {
	if (!file.error) {
		return [file]
	}

	const codeFrame = codeFrameColumns(
		file.content,
		{
			start: { line: file.error.line, column: file.error.column },
		},
		{
			message: file.error.message,
		},
	)

	return [
		{
			...file,
			sandboxed: {
				imports:
					"import { Terminal } from '@es-js/terminal'; import { tiza } from '@es-js/tiza';",
				codeWithoutImports: `
Terminal.clear()

Terminal.escribir(\`Error en el archivo \${tiza.fondoAzul50.azul800(${JSON.stringify(
					file.name,
				)})}:\`)

Terminal.escribir(\`<pre>${codeFrame}</pre>\`)

console.error(${JSON.stringify(file.error.message)})

window.onerror(${JSON.stringify(file.error.message)}, null, ${
					file.error.line
				}, ${file.error.column}, ${JSON.stringify(file.error)})`,
			},
		},
	]
}
