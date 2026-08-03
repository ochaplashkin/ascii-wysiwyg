import React, { forwardRef, useEffect, useLayoutEffect, useRef, useState } from 'react';
import themeData from './themes.js';


export default function ThemePicker(props) {
  return (
    <select
      value={props.theme}
      onChange={e => props.f(e.target.value)} 
    >
      {
        themeData.map((item, index) => {
          return (
            <option value={item}>{item}</option>
          )
        }
      )
      }
    </select>
  );
}