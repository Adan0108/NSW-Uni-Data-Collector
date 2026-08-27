import axios from 'axios';
import * as cheerio from 'cheerio';

import type {
  UsydHandbookRoot,
} from './usyd.handbook-discovery';

export type UsydCourseRootType =
  | 'COURSEWORK'
  | 'UNDERGRADUATE'
  | 'ENGINEERING'
  | 'CONSERVATORIUM'
  | 'SHARED_TABLES';

export interface UsydCourseworkRoot {
  handbookCategory:
    UsydHandbookRoot['category'];

  handbookName: string;

  handbookUrl: string;

  rootType:
    UsydCourseRootType;

  courseworkUrl:
    string | null;
}

function normalizeText(
  value: string,
): string {
  return value
    .replace(
      /[\u200B-\u200D\uFEFF]/g,
      '',
    )
    .replace(
      /\s+/g,
      ' ',
    )
    .trim();
}

function normalizeUrl(
  href: string,
  baseUrl: string,
): string {
  return new URL(
    href,
    baseUrl,
  ).toString();
}

/*
 * Some USYD handbooks do not follow the standard
 * /coursework.html faculty layout.
 *
 * These are handbook-level structural differences,
 * so we classify their correct undergraduate roots
 * here rather than pretending every faculty uses
 * the Science layout.
 */
function getKnownUndergraduateRoot(
  handbook: UsydHandbookRoot,
): UsydCourseworkRoot | null {
  switch (
    handbook.category
  ) {
    case 'ARCHITECTURE':
      return {
        handbookCategory:
          handbook.category,

        handbookName:
          handbook.name,

        handbookUrl:
          handbook.url,

        rootType:
          'UNDERGRADUATE',

        courseworkUrl:
          'https://www.sydney.edu.au/handbooks/architecture/undergraduate/overview.html',
      };

    case 'ENGINEERING':
      /*
       * Engineering's handbook structure is not
       * organised around one /coursework.html page.
       *
       * Keep the faculty handbook itself as the
       * discovery root. The next degree-discovery
       * layer will discover course-specific paths
       * such as engineering-honours from it.
       */
      return {
        handbookCategory:
          handbook.category,

        handbookName:
          handbook.name,

        handbookUrl:
          handbook.url,

        rootType:
          'ENGINEERING',

        courseworkUrl:
          handbook.url,
      };

    case 'INTERDISCIPLINARY':
      /*
       * Interdisciplinary Studies is primarily the
       * shared university tables such as:
       *
       * Table S
       * Table O
       * Table D
       *
       * It is not a normal faculty degree catalogue.
       */
      return {
        handbookCategory:
          handbook.category,

        handbookName:
          handbook.name,

        handbookUrl:
          handbook.url,

        rootType:
          'SHARED_TABLES',

        courseworkUrl:
          null,
      };

    case 'CONSERVATORIUM':
      /*
       * Conservatorium also uses its own handbook
       * navigation rather than the standard faculty
       * /coursework.html layout.
       *
       * Keep its handbook root for the next
       * specialised course discovery stage.
       */
      return {
        handbookCategory:
          handbook.category,

        handbookName:
          handbook.name,

        handbookUrl:
          handbook.url,

        rootType:
          'CONSERVATORIUM',

        courseworkUrl:
          handbook.url,
      };

    case 'LAW':
      return {
        handbookCategory:
          handbook.category,

        handbookName:
          handbook.name,

        handbookUrl:
          handbook.url,

        rootType:
          'UNDERGRADUATE',

        courseworkUrl:
          'https://www.sydney.edu.au/handbooks/law/undergraduate.html',
      };

    default:
      return null;
  }
}

export async function discoverUsydCourseworkRoot(
  handbook: UsydHandbookRoot,
): Promise<UsydCourseworkRoot | null> {
  /*
   * First apply known handbook structures.
   */

  const knownRoot =
    getKnownUndergraduateRoot(
      handbook,
    );

  if (
    knownRoot
  ) {
    return knownRoot;
  }

  /*
   * Standard faculty handbooks:
   *
   * Arts
   * Business
   * Medicine and Health
   * Science
   *
   * These normally expose /coursework.html.
   */

  const response =
    await axios.get<string>(
      handbook.url,
    );

  const $ =
    cheerio.load(
      response.data,
    );

  let discoveredUrl:
    string | null =
    null;

  let discoveredType:
    UsydCourseRootType | null =
    null;

  $('a').each(
    (_, element) => {
      if (
        discoveredUrl
      ) {
        return;
      }

      const anchor =
        $(element);

      const text =
        normalizeText(
          anchor.text(),
        );

      const href =
        anchor.attr(
          'href',
        );

      if (
        !text ||
        !href
      ) {
        return;
      }

      const url =
        normalizeUrl(
          href,
          handbook.url,
        );

      /*
       * Standard coursework structure.
       *
       * Examples:
       *
       * /arts/coursework.html
       * /business-school/coursework.html
       * /medicine-health/coursework.html
       * /science/coursework.html
       */
      if (
        url.endsWith(
          '/coursework.html',
        )
      ) {
        discoveredUrl =
          url;

        discoveredType =
          'COURSEWORK';

        return;
      }

      /*
       * Generic undergraduate overview fallback.
       */
      if (
        /\/undergraduate\/overview\.html$/i.test(
          url,
        )
      ) {
        discoveredUrl =
          url;

        discoveredType =
          'UNDERGRADUATE';

        return;
      }

      if (
        /undergraduate (courses|degrees|coursework)/i.test(
          text,
        )
      ) {
        discoveredUrl =
          url;

        discoveredType =
          'UNDERGRADUATE';
      }
    },
  );

  if (
    !discoveredUrl ||
    !discoveredType
  ) {
    return null;
  }

  return {
    handbookCategory:
      handbook.category,

    handbookName:
      handbook.name,

    handbookUrl:
      handbook.url,

    rootType:
      discoveredType,

    courseworkUrl:
      discoveredUrl,
  };
}