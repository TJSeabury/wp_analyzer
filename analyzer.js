import fs from 'fs';

import {
    exhaustPagedContent
} from './api';

function writeCSV () {
    let data = 'Old Filename, New Filename\n';
    for ( const p of paths ) {
        data += `${p}, [newFilename]\n`;
    }
    fs.writeFileSync( 'filenameMappings.csv', data );
}

const getRouteWriteData = async endpoint => {
    const pp = 100;
    const published = await exhaustPagedContent(
        `wp/v2/${endpoint}`,
        {
            status: 'publish',
            per_page: pp
        },
        metaOnlyFilter
    );
    const drafted = await exhaustPagedContent(
        `wp/v2/${endpoint}`,
        {
            status: 'draft',
            per_page: pp
        },
        metaOnlyFilter
    );
    fs.writeFileSync(
        `published_${endpoint}.json`,
        JSON.stringify( published, null, 2 )
    );
    fs.writeFileSync(
        `drafted_${endpoint}.json`,
        JSON.stringify( drafted, null, 2 )
    );
};

getRouteWriteData( 'pages' );
getRouteWriteData( 'posts' );