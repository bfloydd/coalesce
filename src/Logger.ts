export class Logger {
    private enabled: boolean = false;

    enable() {
        this.enabled = true;
    }

    disable() {
        this.enabled = false;
    }

    debug(message?: any, ...optionalParams: any[]) {
        if (this.enabled) {
            console.debug(message, ...optionalParams);
        }
    }

    info(message?: any, ...optionalParams: any[]) {
        if (this.enabled) {
            console.log(message, ...optionalParams);
        }
    }

    warn(message?: any, ...optionalParams: any[]) {
        if (this.enabled) {
            console.warn(message, ...optionalParams);
        }
    }

    error(message?: any, ...optionalParams: any[]) {
        if (this.enabled) {
            console.error(message, ...optionalParams);
        }
    }
}