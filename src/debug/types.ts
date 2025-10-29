export type ChimeraLogLevel = 'debug' | 'info' | 'off';

export type ChimeraDebugConfig = {
	name?: string;
	logs?: ChimeraLogLevel;
	devMode?: boolean;
};
