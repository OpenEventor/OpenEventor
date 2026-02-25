import { Box, Typography } from '@mui/material';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';

const columns: GridColDef[] = [
  { field: 'bib', headerName: 'Bib', width: 70 },
  { field: 'lastName', headerName: 'Last Name', flex: 1 },
  { field: 'firstName', headerName: 'First Name', flex: 1 },
  { field: 'card', headerName: 'Card', width: 100 },
  { field: 'group', headerName: 'Group', width: 120 },
  { field: 'course', headerName: 'Course', width: 120 },
];

export function CompetitorsPage() {
  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Competitors
      </Typography>
      <DataGrid
        rows={[]}
        columns={columns}
        autoHeight
        disableRowSelectionOnClick
        initialState={{
          pagination: { paginationModel: { pageSize: 25 } },
        }}
        pageSizeOptions={[25, 50, 100]}
      />
    </Box>
  );
}
