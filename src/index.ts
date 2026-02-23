
const fs = require('fs').promises;
const path = require('path');


async function exportAllFiles(dir:string) {
    const exportsObj: Record<string, any>  = {};
    const directoryPath = path.join(__dirname, dir);
    const files = await fs.readdir(directoryPath);

    for (const file of files) {
        const filePath = path.join(directoryPath, file);
        const stat = await fs.stat(filePath);

        if (stat.isFile() && (path.extname(file) === '.js' || path.extname(file) === '.ts')) {
            const moduleName = path.basename(file, path.extname(file));
            if (!moduleName.endsWith('_test')) {
                Object.defineProperty(exportsObj, moduleName, {
                    get() {
                        return require(filePath);
                    }
                });
            }
        }
        else if (stat.isDirectory()) {
            exportsObj[path.basename(file)] = exportAllFiles(file);
        }
    }

    return {[dir]:exportsObj};
}

module.exports = {
    frp: exportAllFiles("frp"),
    converters: exportAllFiles("converters"),
    db: exportAllFiles("db"),
}

