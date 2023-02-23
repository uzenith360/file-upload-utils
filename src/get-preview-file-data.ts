// Added this cos of the ts-node build errors complaining about lib: dom 
/// <reference lib="dom" />

import FileData from "./file-data.type";

export default (file: File): Promise<FileData> =>
    new Promise(
        (resolve, reject) => {
            const reader: FileReader = new FileReader();

            reader.onload = (event: ProgressEvent<FileReader>) => {
                if (event.target) {
                    const image = new Image();
                    image.src = event.target.result as string;

                    image.onload = () => {
                        resolve(
                            {
                                src: reader.result as string,
                                height: image.height,
                                width: image.width
                            },
                        );
                    };

                    image.onerror = () => {
                        reject(event);
                    };
                }
            }

            reader.onerror = (event: ProgressEvent<FileReader>) => {
                reject(event);
            }

            reader.readAsDataURL(file);
        }
    );
