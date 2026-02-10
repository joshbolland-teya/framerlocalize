import { useRef, ChangeEvent } from "react";

export function useFileInput() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const xlfInputRef = useRef<HTMLInputElement>(null);

  const triggerExcelImport = () => {
    fileInputRef.current?.click();
  };

  const triggerXliffImport = () => {
    xlfInputRef.current?.click();
  };

  const handleFileChange = (
    evt: ChangeEvent<HTMLInputElement>,
    callback: (file: File) => void,
  ) => {
    const file = evt.target.files?.[0];
    evt.target.value = "";

    if (file) {
      callback(file);
    }
  };

  return {
    fileInputRef,
    xlfInputRef,
    triggerExcelImport,
    triggerXliffImport,
    handleFileChange,
  };
}
