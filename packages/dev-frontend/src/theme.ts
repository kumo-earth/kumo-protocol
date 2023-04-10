import { Theme, ThemeUIStyleObject } from "theme-ui";

const baseColors = {
  black: "#000000",
  white: "#fff",
  magenta: "#da357a",
  magentaLight: "#f0cfdc",
  magentaDark: "#a81f58",
  magentaMedium: "#de96b3",
  lightGrey: "#e6e6e6",
  transparent: "transparent",

  blue: "#00aed6",
  darkBlue: "#4721BD",
  orange: "#f6701f",
  green: "#4BAD79",
  yellow: "#fd9d28",
  red: "#dc2c10",
  lightRed: "#ff755f"
};

const colors = {
  text: baseColors.black,
  textWhite: baseColors.white,
  background: baseColors.white,
  primary: baseColors.magenta,
  secondary: baseColors.magentaLight,
  muted: baseColors.lightGrey,

  primaryHover: baseColors.magentaDark,
  secondaryHover: baseColors.magentaMedium,
  transparent: baseColors.transparent,

  success: baseColors.green,
  warning: baseColors.orange,
  danger: baseColors.red,
  dangerHover: baseColors.lightRed,
  info: baseColors.blue,
  invalid: "pink"
};

const buttonBase: ThemeUIStyleObject = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: 'Quicksand',
  ":enabled": { cursor: "pointer" }
};

const button: ThemeUIStyleObject = {
  ...buttonBase,
  px: "32px",
  py: "12px",
  color: "textWhite",
  fontStyle: "normal",
  fontWeight: "bold",

  ":disabled": {
    opacity: 0.5
  }
};

const buttonOutline = (color: string, hoverColor: string): ThemeUIStyleObject => ({
  color,
  borderColor: color,
  background: "none",
  fontFamily: 'Quicksand',
  ":enabled:hover": {
    color: "background",
    bg: hoverColor,
    borderColor: hoverColor
  }
});

const iconButton: ThemeUIStyleObject = {
  ...buttonBase,

  padding: 0,
  width: "40px",
  height: "40px",

  background: "none",

  ":disabled": {
    color: "primary",
    opacity: 0.25
  }
};

const cardHeadingFontSize = 18.7167;

const cardHoverEffects: ThemeUIStyleObject = {
  cursor: "pointer",
  transform: "translateY(-3px)",
  backdropFilter: "blur(30px)",
  boxShadow: "rgb(218 53 122 / 37%) 0px 5px 10px",
  transition: "box-shadow 5ms ease 0s"
};

const cardGapX = [0, 3, 4];
const cardGapY = [3, 3, 4];

const card: ThemeUIStyleObject = {
  position: "relative",
  border: 1,
  boxShadow: [1, null, 2]
};

const infoCard: ThemeUIStyleObject = {
  ...card,

  padding: 3,

  borderColor: "rgba(122,199,240,0.4)",
  background: "linear-gradient(200deg, #d4d9fc, #cae9f9)",

  h2: {
    mb: 2,
    fontSize: cardHeadingFontSize
  }
};

const formBase: ThemeUIStyleObject = {
  display: "block",
  width: "auto",
  flexShrink: 0,
  padding: 2,
  fontSize: 3,
  fontFamily: 'Quicksand'
};

const formCell: ThemeUIStyleObject = {
  ...formBase,
  border: 1,
  borderColor: "muted",
  borderRadius: 0,
  boxShadow: [1, 2]
};

const overlay: ThemeUIStyleObject = {
  position: "absolute",

  left: 0,
  top: 0,
  width: "100%",
  height: "100%"
};

const modalOverlay: ThemeUIStyleObject = {
  position: "fixed",

  left: 0,
  top: 0,
  width: "100vw",
  height: "100vh"
};

// const headerGradient: ThemeUIStyleObject = {
//   background: `linear-gradient(90deg, ${colors.background}, ${colors.muted})`
// };

const theme: Theme = {
  breakpoints: ["48em", "52em", "64em"],

  space: [0, 4, 8, 16, 24, 30, 32, 48, 64, 128, 256, 512],

  fonts: {
    body: [
      "Quicksand",
      "-apple-system",
      "BlinkMacSystemFont",
      '"Segoe UI"',
      "Roboto",
      '"Helvetica Neue"',
      "sans-serif"
    ].join(", "),
    heading: "Quicksand",
    monospace: "Menlo, monospace"
  },

  fontSizes: [12, 14, 16, 18, 20, 22, 24, 26, 28, 32, 36, 48, 64, 96],

  fontWeights: {
    body: 400,
    heading: 700,

    light: 200,
    medium: 500,
    mediumBold: 600,
    bold: 700
  },

  lineHeights: {
    body: 1.5,
    heading: 1.25
  },

  colors,

  borders: [0, "1px solid", "2px solid"],

  shadows: ["0", "0px 4px 8px rgba(41, 49, 71, 0.1)", "0px 8px 16px rgba(41, 49, 71, 0.1)"],

  text: {
    heading: {
      fontFamily: "heading",
      fontWeight: "heading",
      lineHeight: "heading"
    },
    normal: {
      fontWeight: "medium"
    },
    normalBold: {
      fontWeight: "bold"
    },
    small: {
      fontSize: 1,
      fontWeight: "bold"
    },
    medium: {
      fontSize: 3,
      fontWeight: "bold"
    },
    large: {
      fontSize: 8,
      fontWeight: "bold"
    },
    xlarge: {
      fontSize: 10,
      fontWeight: "bold"
    }
  },

  images: {
    primary: {
      cursor: "pointer"
    }
  },

  buttons: {
    primary: {
      ...button,
      borderRadius: '72px',
      bg: "primary",
      borderColor: "primary",

      ":enabled:hover": {
        bg: "primaryHover",
        borderColor: "primaryHover"
      }
    },
    primaryInActive: {
      variant: 'buttons.primary',
      opacity: 0.5,
    },
    secondary: {
      ...button,
      borderRadius: '72px',
      color: 'rgba(0, 0, 0, 0.5)',
      bg: "secondary",
      borderColor: "secondary",

      ":enabled:hover": {
        bg: "secondaryHover",
        borderColor: "secondaryHover"
      }
    },
    secondaryInActive: {
      variant: 'buttons.secondary',
      bg: 'rgba(218, 53, 122, 0.2)',
      opacity: 0.5,
    },

    outline: {
      ...button,
      ...buttonOutline("primary", "secondary")
    },

    // cancel: {
    //   ...button,
    //   color: "text",
    //   bg: "secondary",
    //   borderColor: "secondary",
    //   ":enabled:hover": {
    //     bg: "secondaryHover",
    //     borderColor: "secondaryHover"
    //   },
    //   opacity: 0.9
    // },

    icon: {
      ...iconButton,
      color: "primary",
      ":enabled:hover": { color: "accent" }
    },

    dangerIcon: {
      ...iconButton,
      color: "danger",
      ":enabled:hover": { color: "dangerHover" }
    },

    titleIcon: {
      ...iconButton,
      color: "primary",
      ":enabled:hover": { color: "primaryHover" }
    },

  },

  cards: {
    primary: {
      ...card,
      padding: 0,
      borderColor: "muted",
      background: "linear-gradient(128.29deg, #FFFFFF 0%, rgba(255, 255, 255, 0) 127.78%)",
      "> h2": {
        display: "flex",
        alignItems: "center",
        height: "60px",
        borderRadius: "50px 50px 0 0",
        px: 5,
        py: 2
      }
    },
    base: {
      variant: "cards.primary",
      boxShadow: "0 3px 10px rgba(0, 0, 0, 0.5)",
      borderRadius: "50px",
      width: "100%",
      maxWidth: "100%",
      "> h2": {
        variant: "cards.primary.> h2",
        borderBottom: 1,
        borderColor: "muted"
      }
    },

    info: {
      ...infoCard,

      display: ["none", "block"]
    },

    infoPopup: {
      ...infoCard,

      position: "fixed",
      top: 0,
      right: 3,
      left: 3,
      mt: "72px",
      height: "80%",
      overflowY: "scroll"
    },

    portfolioCard: {
      variant: "cards.base",
      ":hover": {
        ...cardHoverEffects
      }
    },

    collateralCard: {
      variant: "cards.primary",
      boxShadow: "0 3px 10px rgba(0, 0, 0, 0.5)",
      borderRadius: "50px",
      width: "97%",
      maxWidth: "100%",
      "> h2": {
        variant: "cards.base.> h2",
        height: "60px"
      },
      ":hover": {
        ...cardHoverEffects
      }
    },
    modalCard: {
      variant: "cards.primary",
      boxShadow: "0 3px 10px rgba(0, 0, 0, 0.5)",
      borderRadius: "50px",
      width: "100%",
      background: 'linear-gradient(128.29deg, rgb(248 213 228 / 37%) 0%, rgba(255, 255, 255, 0) 127.78%)',
      // position: "relative",
      "> h2": {
        variant: "cards.base.> h2",
        height: "60px"
      },
      zIndex: 9999999999,
    },
    StabilityPoolStakingCard: {
      variant: "cards.base",
      border: "none",
      display: "flex",
      flexDirection: "column",
      borderRadius: "50px",
      "> h2": {
        variant: "cards.base.> h2",
        minHeight: "60px",
        height: "max-content"
      },
      ":hover": {
        ...cardHoverEffects
      }
    },

    systemStatsCard: {
      variant: 'cards.modalCard',
      height: '90vh',
      width: '90vw',
      p: 4,
      zIndex: 99,
    },
    walletInstruction : {
      position: "fixed",
      zIndex: 9999,
      height: "100%",
      width: "100%",
      background: "white"
    },
    tooltip: {
      padding: 2,

      border: 1,
      borderColor: "muted",
      borderRadius: "4px",
      bg: "secondary",
      boxShadow: 2,

      fontSize: 1,
      color: "text",
      fontWeight: "body",
      zIndex: 1
    }
  },

  forms: {
    label: {
      ...formBase
    },

    unit: {
      ...formCell,
      textAlign: "center",
      bg: "muted",
    },

    unitSecondary: {
      ...formCell,
      bg: "primary",
      outline: 'none',
      border: 'none',
      color: 'white'
    },

    input: {
      ...formCell,

      flex: 1
    },

    select: {
      ml: 2,
      p: 1,
      border: "none",
      borderRadius: '72px',
      minWidth: [60, 90],
      maxWidth: "max-content",
      bg: "primary",
      borderColor: "primary",
      fontSize: [0, 2],
      color: 'textWhite',
      fontFamily: 'Quicksand',
      ":focus": {
        borderColor: "primary",
        outline: "none"
      }
    },
    editor: {
      fontFamily: 'Quicksand',
    }
  },

  layout: {
    app: {
      position: "relative",
      flexWrap: "wrap",
      height: "100vh",
      overflow: "hidden",
      backgroundSize: "cover",
      backgroundRepeat: "no-repeat",
      flexDirection: "column"
    },
    header: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      px: 5,
      height: "110px",
      borderBottom: 1,
      borderColor: "muted",
      boxShadow: [1, "none"]
    },

    footer: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",

      mt: cardGapY,
      px: 3,
      minHeight: "72px",

      bg: "muted"
    },

    main: {
      position: 'relative',
      height: "calc(100vh - 110px)",
      width: "100%",
      overflow: "auto",
      "::-webkit-scrollbar": {
        display: "none"
      }
    },

    columns: {
      display: "flex",
      flexWrap: "wrap",
      justifyItems: "center"
    },

    left: {
      pr: cardGapX,
      width: ["100%", "58%"]
    },

    right: {
      width: ["100%", "42%"]
    },

    actions: {
      // justifyContent: "flex-end",
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      mt: 2,

      button: {
        minWidth: "64px",
        width: '95%',
      }

    },

    disabledOverlay: {
      ...overlay,

      bg: "rgba(255, 255, 255, 0.5)"
    },

    modalOverlay: {
      ...modalOverlay,

      bg: "rgba(0, 0, 0, 0.8)",

      display: "flex",
      justifyContent: "center",
      alignItems: "center"
    },

    modal: {
      padding: 3,
      width: ["100%", "40em"]
    },

    sideNavOverlay: {
      position: "absolute",
      zIndex: 999999,
      left: 0,
      top: 0,
      width: "100vw",
      height: "100vh",
      bg: 'white',
      overflow: "auto",
      display: ["block", "none"],
    },

    systemStatsOverlay: {
      position: "absolute",
      zIndex: 999999,
      left: 0,
      top: 0,
      width: "100vw",
      height: "100vh",
      bg: 'white',

      display: ["flex", "none"],
      justifyContent: 'center',
      alignItems: 'center',
      "svg" : {
        width: "100% !important"
      }
    },

    infoMessage: {
      display: "flex",
      justifyContent: "center",
      m: 3,
      alignItems: "center",
      minWidth: "128px"
    },

    sideBarOverlay: {
      display: ["none", "flex"],
      border: 1,
      borderColor: "muted",
      height: "100%",
      width: "20vw",
      flexDirection: "column"
    },
    sideBar: {
      display: "flex",
      flexDirection: "column"
    },
    sideBarLogo: {
      display: "flex",
      alignItems: "center",
      pl: 4,
      height: "110px"
    },
    sideBarNav: {
      display: "flex",
      flexDirection: "column",
      pl: 4
    },
    sidenav: {
      display: ["flex", "none"],
      flexDirection: "column",
      pl: 4,
      m: 0,
      borderColor: "muted",
      overflow: 'scroll'
      // ...headerGradient
    },

    dashboard: {
      // position: 'relative',
      flexDirection: "column",
      height: "100%"
    },

    dashboadHeader: {
      display: ["none", "flex"],
      height: 'max-content',
      px: 5,
      pb: 4,
      flexWrap: "wrap"
      // height: "170px"
    },

    badge: {
      border: 0,
      borderRadius: 3,
      p: 1,
      px: 2,
      backgroundColor: "muted",
      color: "slate",
      fontSize: 1,
      fontWeight: "body"
    },
    newTabLinks: {
      ".link": {
        ":hover": {
          color: '#da357a !important'
        }
      }
    }
  },

  styles: {
    root: {
      fontFamily: "body",
      lineHeight: "body",
      fontWeight: "body",

      height: "100%",

      "#root": {
        height: "100%"
      }
    },

    h1: {
      variant: "text.heading"
    },
    h2: {
      variant: "text.heading"
    },

    a: {
      textDecoration: "none",
      fontWeight: "bold"
    }
  },

  links: {
    nav: {
      py: 2,
      fontWeight: 700,
      fontSize: 2,
      textTransform: "uppercase",
      width: ["100%", "auto"],
      mt: [3, "auto"]
    }
  }
};

export default theme;
