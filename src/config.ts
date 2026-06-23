import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";

export interface ComputerUseConfig {
	browser_use: boolean;
	stealth_mode: boolean;
	screenshot_max_dimension: number;
}

export interface ComputerUseConfigSource {
	path: string;
	exists: boolean;
	values?: Partial<ComputerUseConfig>;
	error?: string;
}

export interface LoadedComputerUseConfig {
	config: ComputerUseConfig;
	sources: ComputerUseConfigSource[];
	env: Partial<ComputerUseConfig>;
}

const DEFAULT_CONFIG: ComputerUseConfig = {
	browser_use: true,
	stealth_mode: false,
	screenshot_max_dimension: 0,
};

let activeConfig: ComputerUseConfig = { ...DEFAULT_CONFIG };
let activeLoadedConfig: LoadedComputerUseConfig = { config: activeConfig, sources: [], env: {} };

function parseBoolean(value: unknown): boolean | undefined {
	if (typeof value === "boolean") return value;
	if (typeof value === "number") return value === 1 ? true : value === 0 ? false : undefined;
	if (typeof value !== "string") return undefined;
	const normalized = value.trim().toLowerCase();
	if (["1", "true", "yes", "on", "enabled"].includes(normalized)) return true;
	if (["0", "false", "no", "off", "disabled"].includes(normalized)) return false;
	return undefined;
}

function normalizePartial(raw: unknown): Partial<ComputerUseConfig> {
	if (!raw || typeof raw !== "object") return {};
	const source = (raw as any).computer_use && typeof (raw as any).computer_use === "object" ? (raw as any).computer_use : raw;
	const out: Partial<ComputerUseConfig> = {};
	const browserUse = parseBoolean((source as any).browser_use ?? (source as any).browserUse);
	const stealthMode = parseBoolean((source as any).stealth_mode ?? (source as any).stealthMode);
	if (browserUse !== undefined) out.browser_use = browserUse;
	if (stealthMode !== undefined) out.stealth_mode = stealthMode;
	const maxDim = (source as any).screenshot_max_dimension ?? (source as any).screenshotMaxDimension;
	if (typeof maxDim === "number" && Number.isFinite(maxDim) && maxDim > 0) out.screenshot_max_dimension = Math.trunc(maxDim);
	return out;
}

function readConfigFile(filePath: string): ComputerUseConfigSource {
	if (!existsSync(filePath)) return { path: filePath, exists: false };
	try {
		const parsed = JSON.parse(readFileSync(filePath, "utf-8"));
		return { path: filePath, exists: true, values: normalizePartial(parsed) };
	} catch (error) {
		return { path: filePath, exists: true, error: error instanceof Error ? error.message : String(error) };
	}
}

function readEnv(): Partial<ComputerUseConfig> {
	const out: Partial<ComputerUseConfig> = {};
	const browserUse = parseBoolean(process.env.PI_COMPUTER_USE_BROWSER_USE);
	const stealthMode = parseBoolean(process.env.PI_COMPUTER_USE_STEALTH_MODE);
	if (browserUse !== undefined) out.browser_use = browserUse;
	if (stealthMode !== undefined) out.stealth_mode = stealthMode;
	if (parseBoolean(process.env.PI_COMPUTER_USE_STEALTH) === true || parseBoolean(process.env.PI_COMPUTER_USE_STRICT_AX) === true) {
		out.stealth_mode = true;
	}
	const envMaxDim = process.env.PI_COMPUTER_USE_SCREENSHOT_MAX_DIMENSION;
	if (envMaxDim) {
		const parsed = Number(envMaxDim);
		if (Number.isFinite(parsed) && parsed > 0) out.screenshot_max_dimension = Math.trunc(parsed);
	}
	return out;
}

export function loadComputerUseConfig(cwd: string): LoadedComputerUseConfig {
	const sources = [
		readConfigFile(path.join(getAgentDir(), "extensions", "pi-computer-use.json")),
		readConfigFile(path.join(cwd, ".pi", "computer-use.json")),
	];
	const env = readEnv();
	const config = { ...DEFAULT_CONFIG };
	for (const source of sources) {
		if (source.values) Object.assign(config, source.values);
	}
	Object.assign(config, env);
	activeConfig = config;
	activeLoadedConfig = { config, sources, env };
	return activeLoadedConfig;
}

export function getComputerUseConfig(): ComputerUseConfig {
	return activeConfig;
}

export function getLoadedComputerUseConfig(): LoadedComputerUseConfig {
	return activeLoadedConfig;
}

export function isStrictAxMode(): boolean {
	return activeConfig.stealth_mode;
}

export function isBrowserUseEnabled(): boolean {
	return activeConfig.browser_use;
}

export function getScreenshotMaxDimension(): number {
	return activeConfig.screenshot_max_dimension;
}
