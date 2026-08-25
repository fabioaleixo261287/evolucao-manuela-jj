import React from "react";

export const AVATAR_BOY = "https://cdn-icons-png.flaticon.com/512/3135/3135715.png";
export const AVATAR_GIRL = "https://cdn-icons-png.flaticon.com/512/3135/3135789.png";

export const AVATAR_PRESETS = [
  { id: "preset-girl-1", sexo: "F", label: "Menina 1" },
  { id: "preset-girl-2", sexo: "F", label: "Menina 2" },
  { id: "preset-girl-3", sexo: "F", label: "Menina 3" },
  { id: "preset-boy-1", sexo: "M", label: "Menino 1" },
  { id: "preset-boy-2", sexo: "M", label: "Menino 2" },
  { id: "preset-boy-3", sexo: "M", label: "Menino 3" }
];

export const getAvatarPreset = avatar => AVATAR_PRESETS.find(option => option.id === avatar);
export const getDefaultPresetForSex = sexo => sexo === "F" ? "preset-girl-1" : "preset-boy-1";

export function StudentAvatar({ src, sexo, className = "", alt = "" }) {
  const preset = getAvatarPreset(src);
  if (preset) {
    return <span role="img" aria-label={alt || preset.label} className={`${className} avatar-preset ${preset.id}`} />;
  }
  return <img src={src || (sexo === "F" ? AVATAR_GIRL : AVATAR_BOY)} className={className} alt={alt} />;
}

export function AvatarOptions({ sexo, value, onSelect }) {
  return (
    <div className="avatar-options-grid">
      {AVATAR_PRESETS.filter(option => option.sexo === sexo).map(option => (
        <button type="button" key={option.id} className={`avatar-option ${value === option.id ? "selected" : ""}`} onClick={() => onSelect(option.id)}>
          <StudentAvatar src={option.id} sexo={sexo} alt={option.label} />
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  );
}
