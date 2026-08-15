import React, { forwardRef, useEffect, useLayoutEffect, useRef, useState } from 'react';
import themeData from './themes.js';

interface ThemePickerProps {
  theme: string;
  f: (theme: string) => void;
}


export default function ThemePicker(props: ThemePickerProps) {
  return (
    <select
      value={props.theme}
      onChange={e => props.f(e.target.value)} 
    >
      {
        themeData.map((item) => {
          return (
            <option value={item}>{item}</option>
          )
        }
      )
      }
    </select>
  );
}